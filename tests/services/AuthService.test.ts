// npm test -- tests/services/AuthService.test.ts
import mongoose from 'mongoose';
import User from '../../src/models/User';
import { AuthService } from '../../src/services/AuthService';
import dotenv from 'dotenv';

// 테스트 환경 변수 로드 (.env.test.local이 있다면 사용)
dotenv.config({ path: '.env.test.local' });

describe('AuthService Test', () => {
    let authService: AuthService;

    beforeAll(async () => {
        // 테스트용 DB URI 사용 (환경 변수 우선, 없으면 로컬 테스트 DB 사용)
        const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erica-capstone-test';

        // 이미 연결된 상태라면 끊고 다시 연결 (중복 연결 방지)
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        await mongoose.connect(mongoURI);

        // AuthService 인스턴스 가져오기 (싱글톤)
        authService = AuthService.getInstance();
    });

    afterAll(async () => {
        // 테스트가 끝나면 DB를 정리하고 연결 종료
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.dropDatabase();
            await mongoose.connection.close();
        }
    });

    afterEach(async () => {
        // 각 테스트 케이스 실행 후 데이터 삭제 (독립성 보장)
        await User.deleteMany({});
    });

    describe('register', () => {
        it('should successfully register a new user', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
            };

            const result = await authService.register(userData);

            // 리턴값 구조 확인
            expect(result.user).toBeDefined();
            expect(result.user.id).toBeDefined();
            expect(result.user.email).toBe(userData.email);
            expect(result.user.name).toBe(userData.name);
            expect(result.user.role).toBe('student'); // 기본값

            // 데이터베이스에 저장되었는지 확인
            const savedUser = await User.findById(result.user.id);
            expect(savedUser).not.toBeNull();
            expect(savedUser?.email).toBe(userData.email);
        });

        it('should throw Error if user already exists', async () => {
            const userData = {
                email: 'duplicate@example.com',
                password: 'password123',
                name: 'Duplicate User Test',
            };

            // 첫 번째 가입
            await authService.register(userData);

            // 동일 이메일로 두 번째 가입 시도
            await expect(authService.register({
                ...userData,
                name: 'Another Name',
            })).rejects.toThrow('User already exists');
        });
    });

    describe('login', () => {
        const registerData = {
            email: 'login@example.com',
            password: 'mypassword123',
            name: 'Login Test User',
        };

        beforeEach(async () => {
            // 로그인 테스트를 위해 유저를 미리 가입
            await authService.register(registerData);
        });

        it('should successfully login with valid credentials', async () => {
            const result = await authService.login({
                username: registerData.email,
                password: registerData.password,
            });

            expect(result.user).toBeDefined();
            expect(result.user.email).toBe(registerData.email);
            expect(result.token).toBe('dummy-jwt-token'); // 현재 더미 토큰으로 구현된 상태
        });

        it('should throw Error if password does not match', async () => {
            await expect(authService.login({
                username: registerData.email,
                password: 'wrongpassword',
            })).rejects.toThrow('Invalid credentials');
        });

        it('should throw Error if user email does not exist', async () => {
            await expect(authService.login({
                username: 'notfound@example.com',
                password: 'mypassword123',
            })).rejects.toThrow('Invalid credentials');
        });

        it('should throw Error if both email and password are not provided', async () => {
            await expect(authService.login({
                username: registerData.email, // password 누락
            })).rejects.toThrow('Email and password are required');
        });
    });

    describe('withdraw', () => {
        it('should successfully withdraw(delete) user', async () => {
            const userData = {
                email: 'withdraw@example.com',
                password: 'password123',
                name: 'Withdraw User',
            };

            // 가입 진행
            const registerResult = await authService.register(userData);
            const userId = registerResult.user.id;

            // 유저 존재 확인
            let dbUser = await User.findById(userId);
            expect(dbUser).not.toBeNull();

            // 탈퇴 처리
            await authService.withdraw(userId);

            // 데이터베이스에서 삭제되었는지 확인
            dbUser = await User.findById(userId);
            expect(dbUser).toBeNull();
        });

        it('should throw Error if user is not found when withdrawing', async () => {
            // 임의의 ObjectId
            const fakeId = new mongoose.Types.ObjectId().toString();

            await expect(authService.withdraw(fakeId)).rejects.toThrow('User not found');
        });
    });
});
