// pnpm test -- tests/controllers/AuthController.test.ts
import mongoose from 'mongoose';
import { Request as ExRequest } from 'express';
import User from 'src/models/User';
import Verification from 'src/models/Verification'; // [추가] 인증 모델 import
import { AuthController } from 'src/controllers/AuthController';
import { connectTestDB, closeAndDropTestDB, clearTestData } from 'tests/test-db-handler';

describe('AuthController Test', () => {
    let authController: AuthController;

    beforeAll(async () => {
        await connectTestDB();
    });

    afterAll(async () => {
        await closeAndDropTestDB();
    });

    beforeEach(async () => {
        await clearTestData();
        authController = new AuthController();
    });

    afterEach(async () => {
        await clearTestData();
    });

    /**
     * Express Request 모킹 헬퍼 함수
     * 이제 session 대신 JWT 검증 미들웨어가 통과시킨 user(userId)만 주입합니다.
     */
    const createMockRequest = (userId?: string): ExRequest => {
        return {
            user: userId,
        } as unknown as ExRequest;
    };

    describe('register', () => {
        it('should successfully register a new user and return accessToken', async () => {
            const userData = {
                email: 'controller_test@gmail.com',
                password: 'Testpassword123!',
            };

            // [추가] 가입 전, 이메일 인증이 완료되었다는 가짜 데이터 생성
            await Verification.create({ 
                email: userData.email, 
                code: '000000', 
                isVerified: true 
            });

            // req 인자 제거
            const result = await authController.register(userData) as any;

            expect(authController.getStatus()).toBe(201);
            expect(result.user).toBeDefined();
            expect(result.user.email).toBe(userData.email);

            // [수정] 세션 확인 대신 JWT 토큰이 잘 발급되었는지 확인
            expect(result.accessToken).toBeDefined();
            expect(typeof result.accessToken).toBe('string');
        });

        it('should return 400 error if user already exists', async () => {
            const userData = {
                email: 'duplicate_controller@gmail.com',
                password: 'Testpassword123!',
            };

            await Verification.create({ email: userData.email, code: '000000', isVerified: true });
            await authController.register(userData);

            // 동일 이메일로 두 번째 가입 시도 (더 이상 Verification을 만들지 않아도 User 중복에서 걸림)
            const result = await authController.register(userData) as any;

            expect(authController.getStatus()).toBe(400);
            expect(result.error).toBe('User already exists');
        });
    });

    describe('login', () => {
        const loginData = {
            email: 'login_controller@gmail.com',
            password: 'Testpassword123!',
        };

        beforeEach(async () => {
            await Verification.create({ email: loginData.email, code: '000000', isVerified: true });
            await authController.register(loginData);
        });

        it('should successfully login and return accessToken', async () => {
            // req 인자 제거
            const result = await authController.login({
                email: loginData.email,
                password: loginData.password,
            }) as any;

            expect(result.user).toBeDefined();
            expect(result.user.email).toBe(loginData.email);

            // [수정] 세션 대신 JWT 발급 확인
            expect(result.accessToken).toBeDefined();
        });

        it('should return 401 error if password does not match', async () => {
            const result = await authController.login({
                email: loginData.email,
                password: 'wrongpassword',
            }) as any;

            expect(authController.getStatus()).toBe(401);
            expect(result.error).toBe('Invalid credentials');
        });
    });

    describe('logout', () => {
        let registeredUserId: string;

        beforeEach(async () => {
            const loginData = { email: 'logout@gmail.com', password: 'Testpassword123!' };
            await Verification.create({ email: loginData.email, code: '000000', isVerified: true });
            const result = await authController.register(loginData) as any;
            registeredUserId = result.user.id; // 로그아웃에 사용할 유저 ID 확보
        });

        it('should successfully nullify activeToken in DB', async () => {
            // session 대신 등록된 userId를 가진 mockReq 생성
            const mockReq = createMockRequest(registeredUserId);

            const result = await authController.logout(mockReq) as { message: string };

            expect(result.message).toBe('Successfully logged out');

            // DB에서 해당 유저의 토큰이 비워졌는지 확인
            const dbUser = await User.findById(registeredUserId);
            expect(dbUser?.activeToken).toBeNull();
        });
    });

    describe('leave', () => {
        const leaveData = {
            email: 'leave_controller@gmail.com',
            password: 'Testpassword123!',
        };
        let registeredUserId: string;

        beforeEach(async () => {
            await Verification.create({ email: leaveData.email, code: '000000', isVerified: true });
            const result = await authController.register(leaveData) as any;
            registeredUserId = result.user.id; // 회원탈퇴에 사용할 유저 ID 확보
        });

        it('should successfully leave and delete user from DB', async () => {
            // session의 이메일 대신 등록된 userId를 가진 mockReq 생성
            const mockReq = createMockRequest(registeredUserId);

            const result = await authController.leave(mockReq) as any;

            expect(result.message).toBe('User successfully left');

            // DB에서 실제로 삭제되었는지 확인
            const dbUser = await User.findById(registeredUserId);
            expect(dbUser).toBeNull();
        });

        it('should return 404 if user not found in DB', async () => {
            // 존재하지 않는 가짜 ObjectId 모킹
            const fakeUserId = new mongoose.Types.ObjectId().toString();
            const mockReq = createMockRequest(fakeUserId);

            const result = await authController.leave(mockReq) as any;

            expect(authController.getStatus()).toBe(404);
            expect(result.error).toBe('User not found');
        });
    });
});
