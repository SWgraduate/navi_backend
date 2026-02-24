// npm test -- tests/models/User.test.ts
import mongoose from 'mongoose';
import User from '../../src/models/User';
import dotenv from 'dotenv';

// 테스트 환경 변수 로드 (.env.test.local이 있다면 사용)
dotenv.config({ path: '.env.test.local' });

describe('User Model Test', () => {
  beforeAll(async () => {
    // 테스트용 DB URI 사용 (환경 변수 우선, 없으면 로컬 테스트 DB 사용)
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erica-capstone-test';

    // 이미 연결된 상태라면 끊고 다시 연결 (중복 연결 방지)
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(mongoURI);
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

  it('create & save user successfully', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };
    const validUser = new User(userData);
    const savedUser = await validUser.save();

    // ID 생성 확인
    expect(savedUser._id).toBeDefined();

    // 필드 값 일치 확인
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.name).toBe(userData.name);

    // 기본값(default) 확인
    expect(savedUser.role).toBe('user');

    // 비밀번호 해싱 확인 (원본 비밀번호와 달라야 함)
    expect(savedUser.password).not.toBe(userData.password);

    // createdAt, updatedAt 자동 생성 확인
    expect(savedUser.createdAt).toBeDefined();
    expect(savedUser.updatedAt).toBeDefined();
  });

  it('insert user successfully, but the field not defined in schema should be undefined', async () => {
    const userData = {
      email: 'test2@example.com',
      password: 'password123',
      name: 'Test User 2',
      age: 25, // 스키마에 없는 필드
    };
    const userWithInvalidField = new User(userData);
    const savedUser = await userWithInvalidField.save();

    expect(savedUser._id).toBeDefined();
    // @ts-ignore: 테스트를 위해 강제 접근
    expect(savedUser.age).toBeUndefined();
  });

  it('create user without required field should failed', async () => {
    const userWithoutRequiredField = new User({ name: 'No Email User' });
    let err;
    try {
      await userWithoutRequiredField.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    // @ts-ignore
    expect(err.errors.email).toBeDefined();
    // @ts-ignore
    expect(err.errors.password).toBeDefined();
  });

  it('create user with duplicate email should failed', async () => {
    const userData = {
      email: 'duplicate@example.com',
      password: 'password123',
      name: 'User 1',
    };

    // 첫 번째 사용자 저장
    await new User(userData).save();

    // 동일한 이메일로 두 번째 사용자 생성 시도
    const duplicateUser = new User({
      ...userData,
      name: 'User 2',
    });

    let err;
    try {
      await duplicateUser.save();
    } catch (error) {
      err = error;
    }

    // MongoDB duplicate key error (code 11000)
    expect(err).toBeDefined();
    // @ts-ignore
    expect(err.code).toBe(11000);
  });

  it('comparePassword method should work correctly', async () => {
    const password = 'mySecretPassword';
    const user = new User({
      email: 'auth@example.com',
      password: password,
      name: 'Auth User',
    });

    await user.save();

    // 올바른 비밀번호 비교
    const isMatch = await user.comparePassword(password);
    expect(isMatch).toBe(true);

    // 틀린 비밀번호 비교
    const isNotMatch = await user.comparePassword('wrongPassword');
    expect(isNotMatch).toBe(false);
  });
});
