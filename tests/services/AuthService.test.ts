// pnpm test -- tests/services/AuthService.test.ts
import mongoose from 'mongoose';
import User from 'src/models/User';
import Verification from 'src/models/Verification'; // [추가]
import { AuthService } from 'src/services/AuthService';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test.local' });

describe('AuthService Test', () => {
  let authService: AuthService;

  beforeAll(async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoURI);

    await User.deleteMany({});
    await Verification.deleteMany({}); // [추가]
    await User.createIndexes();

    authService = AuthService.getInstance();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Verification.deleteMany({}); // [추가]
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const userData = { email: 'test@example.com', password: 'password123' };

      // [추가] 가입 전 인증 완료 상태 생성
      await Verification.create({ email: userData.email, code: '000000', isVerified: true });

      const result = await authService.register(userData);

      expect(result.user).toBeDefined();
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.role).toBe('student');

      const savedUser = await User.findById(result.user.id);
      expect(savedUser).not.toBeNull();
      expect(savedUser?.email).toBe(userData.email);
    });

    it('should throw Error if user already exists', async () => {
      const userData = { email: 'duplicate@example.com', password: 'password123' };

      await Verification.create({ email: userData.email, code: '000000', isVerified: true });
      await authService.register(userData);

      await expect(authService.register(userData)).rejects.toThrow('User already exists');
    });
  });

  describe('login', () => {
    const registerData = { email: 'login@example.com', password: 'mypassword123' };

    beforeEach(async () => {
      // [추가] 로그인 테스트를 위해 가입 전 인증 완료 상태 생성
      await Verification.create({ email: registerData.email, code: '000000', isVerified: true });
      await authService.register(registerData);
    });

    it('should successfully login with valid credentials', async () => {
      const result = await authService.login(registerData);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(registerData.email);
    });

    it('should throw Error if password does not match', async () => {
      await expect(authService.login({ email: registerData.email, password: 'wrongpassword' }))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw Error if user email does not exist', async () => {
      await expect(authService.login({ email: 'notfound@example.com', password: 'mypassword123' }))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw Error if both email and password are not provided', async () => {
      await expect(authService.login({ email: registerData.email } as any))
        .rejects.toThrow('Email and password are required');
    });
  });

  describe('leave', () => {
    it('should successfully leave(delete) user', async () => {
      const userData = { email: 'leave@example.com', password: 'password123' };

      // [추가] 가입 진행
      await Verification.create({ email: userData.email, code: '000000', isVerified: true });
      const registerResult = await authService.register(userData);
      const userId = registerResult.user.id; // 등록된 userId 확보

      let dbUser = await User.findById(userId);
      expect(dbUser).not.toBeNull();

      // [수정] 이메일이 아니라 userId 전달
      await authService.leave(userId);

      dbUser = await User.findById(userId);
      expect(dbUser).toBeNull();
    });

    it('should throw Error if user is not found when leaving', async () => {
      // [수정] 존재하지 않는 이메일이 아니라, 가짜 ObjectId 전달
      const fakeUserId = new mongoose.Types.ObjectId().toString();

      await expect(authService.leave(fakeUserId)).rejects.toThrow('User not found');
    });
  });
});
