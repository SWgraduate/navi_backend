// pnpm test -- tests/controllers/StudentController.test.ts
import mongoose from 'mongoose';
import { Request as ExRequest } from 'express';
import dotenv from 'dotenv';
import User from 'src/models/User';
import Student from 'src/models/Student';
import AcademicRecord from 'src/models/AcademicRecord';
import { StudentController } from 'src/controllers/StudentController';

dotenv.config({ path: '.env.test.local' });

// ─── logger 모킹 ─────────────────────────────────────────────────────────────
jest.mock('src/utils/log', () => ({
  logger: {
    i: jest.fn(),
    w: jest.fn(),
    e: jest.fn(),
  },
}));

// ─── VisionService 모킹 ───────────────────────────────────────────────────────
const mockParseGraduationRecord = jest.fn();
jest.mock('src/services/VisionService', () => ({
  VisionService: jest.fn().mockImplementation(() => ({
    parseGraduationRecord: mockParseGraduationRecord,
  })),
}));

// ─── 공통 픽스처 ──────────────────────────────────────────────────────────────
const PROFILE_BODY = {
  admissionYear: 2021,
  name: '김테스트',
  major: '컴퓨터공학부',
  secondMajorType: '선택' as const,
  academicStatus: '재학생' as const,
  completedSemesters: 4,
};

describe('StudentController Test', () => {
  let studentController: StudentController;
  let testUserId: string;

  /**
   * Express Request 모킹 헬퍼 – AuthController.test.ts와 동일한 패턴 사용
   */
  const createMockRequest = (sessionData: Record<string, any> = {}): ExRequest => {
    return {
      session: {
        ...sessionData,
        destroy: jest.fn((cb) => cb(null)),
      },
      res: {
        clearCookie: jest.fn(),
      },
    } as unknown as ExRequest;
  };

  beforeAll(async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoURI);

    await Student.createIndexes();
    await AcademicRecord.createIndexes();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Student.deleteMany({});
    await AcademicRecord.deleteMany({});

    // 각 테스트마다 임시 User 생성
    const user = new User({ email: `ctrl_${Date.now()}@example.com`, password: 'password123' });
    const saved = await user.save();
    testUserId = saved._id.toString();

    studentController = new StudentController();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Student.deleteMany({});
    await AcademicRecord.deleteMany({});
  });

  // ─── POST /student/me/profile ──────────────────────────────────────────────
  describe('upsertProfile', () => {
    it('로그인 세션이 없으면 401을 반환해야 함', async () => {
      const req = createMockRequest(); // userId 없음
      const result = await studentController.upsertProfile(PROFILE_BODY, req) as any;

      expect(studentController.getStatus()).toBe(401);
      expect(result.error).toBeDefined();
    });

    it('정상 세션으로 학적 정보를 등록하면 200과 Student 도큐먼트를 반환해야 함', async () => {
      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.upsertProfile(PROFILE_BODY, req) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.name).toBe(PROFILE_BODY.name);
      expect(result.major).toBe(PROFILE_BODY.major);
    });

    it('동일 세션으로 다시 호출하면 갱신(upsert)되어야 함', async () => {
      const req1 = createMockRequest({ userId: testUserId });
      await studentController.upsertProfile(PROFILE_BODY, req1);

      const req2 = createMockRequest({ userId: testUserId });
      const result = await studentController.upsertProfile(
        { ...PROFILE_BODY, major: '소프트웨어학부' },
        req2
      ) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.major).toBe('소프트웨어학부');

      // DB에 중복 레코드가 없어야 함
      const count = await Student.countDocuments({ userId: new mongoose.Types.ObjectId(testUserId) });
      expect(count).toBe(1);
    });
  });

  // ─── GET /student/me/profile ───────────────────────────────────────────────
  describe('getProfile', () => {
    it('로그인 세션이 없으면 401을 반환해야 함', async () => {
      const req = createMockRequest();
      const result = await studentController.getProfile(req) as any;

      expect(studentController.getStatus()).toBe(401);
      expect(result.error).toBeDefined();
    });

    it('학적 정보가 없으면 404를 반환해야 함', async () => {
      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.getProfile(req) as any;

      expect(studentController.getStatus()).toBe(404);
      expect(result.error).toBeDefined();
    });

    it('학적 정보가 있으면 200과 Student 도큐먼트를 반환해야 함', async () => {
      // 먼저 등록
      const upsertReq = createMockRequest({ userId: testUserId });
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.getProfile(req) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.name).toBe(PROFILE_BODY.name);
    });
  });

  // ─── GET /student/me/academic-record ──────────────────────────────────────
  describe('getAcademicRecord', () => {
    it('로그인 세션이 없으면 401을 반환해야 함', async () => {
      const req = createMockRequest();
      const result = await studentController.getAcademicRecord(req) as any;

      expect(studentController.getStatus()).toBe(401);
      expect(result.error).toBeDefined();
    });

    it('Student가 없으면 404를 반환해야 함', async () => {
      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.getAcademicRecord(req) as any;

      expect(studentController.getStatus()).toBe(404);
      expect(result.error).toBeDefined();
    });

    it('AcademicRecord가 없으면 404를 반환해야 함', async () => {
      // Student만 등록, AcademicRecord는 없음
      const upsertReq = createMockRequest({ userId: testUserId });
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.getAcademicRecord(req) as any;

      expect(studentController.getStatus()).toBe(404);
      expect(result.error).toBeDefined();
    });

    it('AcademicRecord가 있으면 200을 반환해야 함', async () => {
      // Student 등록 + AcademicRecord 생성
      const upsertReq = createMockRequest({ userId: testUserId });
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      const student = await Student.findOne({ userId: new mongoose.Types.ObjectId(testUserId) });
      await AcademicRecord.create({
        studentId: student!._id,
        earnedCredits: { total: 80, majorCore: 20, majorAdvanced: 15, majorTotal: 35, generalElective: 30, socialService: 2, industry: 3 },
        completedConditions: { englishCourses: 1, pblTotal: 2, pblMajor: 1 },
        takenCourses: [],
      });

      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.getAcademicRecord(req) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.earnedCredits.total).toBe(80);
    });
  });

  // ─── PUT /student/me/academic-record ──────────────────────────────────────
  describe('updateAcademicRecord', () => {
    it('로그인 세션이 없으면 401을 반환해야 함', async () => {
      const req = createMockRequest();
      const result = await studentController.updateAcademicRecord({}, req) as any;

      expect(studentController.getStatus()).toBe(401);
      expect(result.error).toBeDefined();
    });

    it('Student가 없으면 400을 반환해야 함', async () => {
      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.updateAcademicRecord(
        { earnedCredits: { total: 50 } },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(400);
      expect(result.error).toBeDefined();
    });

    it('earnedCredits 수정 요청이 정상 처리되어야 함', async () => {
      // Student 등록
      const upsertReq = createMockRequest({ userId: testUserId });
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.updateAcademicRecord(
        { earnedCredits: { total: 120, majorCore: 40 } },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.earnedCredits.total).toBe(120);
      expect(result.earnedCredits.majorCore).toBe(40);
    });
  });

  // ─── POST /student/me/academic-record/parse ────────────────────────────────
  describe('parseAndUpdateFromImage', () => {
    it('로그인 세션이 없으면 401을 반환해야 함', async () => {
      const req = createMockRequest();
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: 'fakeBase64' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(401);
      expect(result.error).toBeDefined();
    });

    it('imageBase64가 비어있으면 400을 반환해야 함', async () => {
      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: '' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(400);
      expect(result.error).toBeDefined();
    });

    it('파싱 성공 시 200과 갱신된 AcademicRecord를 반환해야 함', async () => {
      // Student 등록
      const upsertReq = createMockRequest({ userId: testUserId });
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      mockParseGraduationRecord.mockResolvedValueOnce({
        isSuccess: true,
        confidence: 88,
        reason: '정상 파싱됨',
        academicRecord: { totalCredits: 105, majorCore: 34, majorAdvanced: 38, generalElective: 29 },
      });

      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: 'fakeBase64Data' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.earnedCredits.total).toBe(105);
      expect(result.earnedCredits.majorCore).toBe(34);
    });

    it('VisionService가 isSuccess=false를 반환하면 422를 반환해야 함', async () => {
      const upsertReq = createMockRequest({ userId: testUserId });
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      mockParseGraduationRecord.mockResolvedValueOnce({
        isSuccess: false,
        confidence: 20,
        reason: '화질 저하로 인식 불가',
      });

      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: 'fakeBase64Data' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(422);
      expect(result.error).toContain('이미지 파싱에 실패');
    });

    it('Student 레코드가 없을 때 파싱 요청하면 400을 반환해야 함', async () => {
      const req = createMockRequest({ userId: testUserId });
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: 'fakeBase64Data' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(400);
      expect(result.error).toBeDefined();

      // VisionService는 호출되지 않아야 함
      expect(mockParseGraduationRecord).not.toHaveBeenCalled();
    });
  });
});
