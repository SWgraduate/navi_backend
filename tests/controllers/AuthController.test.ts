// pnpm test -- tests/controllers/AuthController.test.ts
import mongoose from 'mongoose';
import { Request as ExRequest } from 'express';
import User from 'src/models/User';
import { AuthController } from 'src/controllers/AuthController';
import dotenv from 'dotenv';

// 테스트 환경 변수 로드 (.env.test.local이 있다면 사용)
dotenv.config({ path: '.env.test.local' });

describe('AuthController Test', () => {
    let authController: AuthController;

    beforeAll(async () => {
        // 테스트용 DB URI 사용 (환경 변수 우선, 없으면 로컬 테스트 DB 사용)
        const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';

        // 이미 연결된 상태라면 끊고 다시 연결 (중복 연결 방지)
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        await mongoose.connect(mongoURI);

        // 이전 테스트 실행에 남은 데이터 정리 (다른 테스트 파일이 남긴 데이터 방지)
        await User.deleteMany({});

        // 테스트 실행 전 unique 인덱스가 생성되도록 보장
        await User.createIndexes();
    });

    afterAll(async () => {
        // 테스트가 끝나면 DB를 정리하고 연결 종료
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.dropDatabase();
            await mongoose.connection.close();
        }
    });

    beforeEach(() => {
        // 각 테스트마다 컨트롤러 인스턴스 초기화
        authController = new AuthController();
    });

    afterEach(async () => {
        // 각 테스트 케이스 실행 후 데이터 삭제 (독립성 보장)
        await User.deleteMany({});
    });

    /**
     * Express Request 모킹 헬퍼 함수
     */
    const createMockRequest = (sessionData = {}): ExRequest => {
        return {
            session: {
                ...sessionData,
                destroy: jest.fn((callback) => callback(null)),
            },
            res: {
                clearCookie: jest.fn(),
            },
        } as unknown as ExRequest;
    };

    describe('register', () => {
        it('should successfully register a new user and set session', async () => {
            const userData = {
                email: 'controller_test@example.com',
                password: 'password123',
            };
            const mockReq = createMockRequest();

            const result = await authController.register(userData, mockReq) as any;

            // 상태 코드 확인 (Controller 내부에서 201 설정)
            expect(authController.getStatus()).toBe(201);

            // 리턴값 구조 확인
            expect(result.user).toBeDefined();
            expect(result.user.email).toBe(userData.email);

            // 세션에 값이 정상적으로 할당되었는지 확인
            const session = mockReq.session as any;
            expect(session.userEmail).toBe(result.user.email);
            expect(session.userId).toBe(result.user.id);
            expect(session.role).toBe(result.user.role);
        });

        it('should return 400 error if user already exists', async () => {
            const userData = {
                email: 'duplicate_controller@example.com',
                password: 'password123',
            };

            // 첫 번째 가입
            const mockReq1 = createMockRequest();
            await authController.register(userData, mockReq1);

            // 동일 이메일로 두 번째 가입 시도
            const mockReq2 = createMockRequest();
            const result = await authController.register(userData, mockReq2) as any;

            expect(authController.getStatus()).toBe(400);
            expect(result.error).toBeDefined();
            expect(result.error).toBe('User already exists');
        });
    });

    describe('login', () => {
        const loginData = {
            email: 'login_controller@example.com',
            password: 'password123',
        };

        beforeEach(async () => {
            // 로그인 테스트를 위해 유저 미리 가입
            const mockReq = createMockRequest();
            await authController.register(loginData, mockReq);
        });

        it('should successfully login and set session', async () => {
            const mockReq = createMockRequest();
            const result = await authController.login({
                email: loginData.email,
                password: loginData.password,
            }, mockReq) as any;

            expect(result.user).toBeDefined();
            expect(result.user.email).toBe(loginData.email);

            // 세션 할당 확인
            const session = mockReq.session as any;
            expect(session.userEmail).toBe(result.user.email);
            expect(session.userId).toBe(result.user.id);
            expect(session.role).toBe(result.user.role);
        });

        it('should return 401 error if password does not match', async () => {
            const mockReq = createMockRequest();
            const result = await authController.login({
                email: loginData.email,
                password: 'wrongpassword',
            }, mockReq) as any;

            expect(authController.getStatus()).toBe(401);
            expect(result.error).toBe('Invalid credentials');
        });
    });

    describe('logout', () => {
        it('should successfully destroy session and clear cookie', async () => {
            const mockReq = createMockRequest({ userEmail: 'test@example.com' });

            const result = await authController.logout(mockReq) as { message: string };

            expect(result.message).toBe('Successfully logged out');
            expect(mockReq.session.destroy).toHaveBeenCalled();
            expect(mockReq.res?.clearCookie).toHaveBeenCalledWith('connect.sid');
        });
    });

    describe('leave', () => {
        const leaveData = {
            email: 'leave_controller@example.com',
            password: 'password123',
        };

        beforeEach(async () => {
            const mockReq = createMockRequest();
            await authController.register(leaveData, mockReq);
        });

        it('should successfully leave and destroy session', async () => {
            // 로그인된 세션 상태 모킹 (email이 세션에 있어야 함)
            const mockReq = createMockRequest({ userEmail: leaveData.email });

            const result = await authController.leave(mockReq) as any;

            expect(result.message).toBe('User successfully left');
            expect(mockReq.session.destroy).toHaveBeenCalled();
            expect(mockReq.res?.clearCookie).toHaveBeenCalledWith('connect.sid');

            // DB에서 실제로 삭제되었는지 확인
            const dbUser = await User.findOne({ email: leaveData.email });
            expect(dbUser).toBeNull();
        });

        it('should return 401 if user email is not in session', async () => {
            // 세션에 이메일 정보가 없는 상태 모킹
            const mockReq = createMockRequest();

            const result = await authController.leave(mockReq) as any;

            expect(authController.getStatus()).toBe(401);
            expect(result.error).toBe('Unauthorized');
        });

        it('should return 404 if user not found in DB but has session', async () => {
            const fakeEmail = 'nonexistent@example.com';
            const mockReq = createMockRequest({ userEmail: fakeEmail });

            const result = await authController.leave(mockReq) as any;

            expect(authController.getStatus()).toBe(404);
            expect(result.error).toBe('User not found');
        });
    });
});
