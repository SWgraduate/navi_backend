// pnpm test -- tests/controllers/StudentController.test.ts
import mongoose from 'mongoose';
import { Request as ExRequest } from 'express';
import User from 'src/models/User';
import Student from 'src/models/Student';
import AcademicRecord from 'src/models/AcademicRecord';
import { StudentController } from 'src/controllers/StudentController';
import { connectTestDB, closeAndDropTestDB, clearTestData } from 'tests/test-db-handler';

// ─── logger 모킹 ─────────────────────────────────────────────────────────────
jest.mock('src/utils/log', () => ({
  logger: {
    i: jest.fn(),
    w: jest.fn(),
    e: jest.fn(),
  },
}));

// ─── VisionService 모킹 ───────────────────────────────────────────────────────
jest.mock('src/services/VisionService', () => ({
  VisionService: jest.fn(),
}));

import { VisionService } from 'src/services/VisionService';
const MockedVisionService = jest.mocked(VisionService);
let mockParseGraduationRecord: jest.Mock;

// ─── 공통 픽스처 ──────────────────────────────────────────────────────────────
const PROFILE_BODY = {
  admissionYear: 2021,
  studentNumber: '2021111111',
  name: '김테스트',
  major: '컴퓨터공학부',
  secondMajorType: '없음' as const,
  academicStatus: '재학생' as const,
  completedSemesters: 4,
};

describe('StudentController Test', () => {
  let studentController: StudentController;
  let testUserId: string;

  /**
   * Express Request 모킹 헬퍼 – JWT 미들웨어가 통과시킨 user(userId)를 주입
   */
  const createMockRequest = (userId: string): ExRequest => {
    return {
      user: userId, // [수정] session 대신 user 속성에 ID 직접 할당
    } as unknown as ExRequest;
  };

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeAndDropTestDB();
  });

  beforeEach(async () => {
    await clearTestData();

    // 각 테스트마다 임시 User 생성
    const user = new User({ email: `ctrl_${Date.now()}@example.com`, password: 'password123' });
    const saved = await user.save();
    testUserId = saved._id.toString();

    // 각 테스트마다 VisionService mock 인스턴스를 새로 세팅
    mockParseGraduationRecord = jest.fn();
    MockedVisionService.mockImplementation(() => ({
      parseGraduationRecord: mockParseGraduationRecord,
    }) as unknown as VisionService);

    studentController = new StudentController();
  });

  afterEach(async () => {
    await clearTestData();
  });

  // ─── POST /student/me/profile ──────────────────────────────────────────────
  describe('upsertProfile', () => {
    it('정상 세션으로 학적 정보를 등록하면 200과 Student 도큐먼트를 반환해야 함', async () => {
      const req = createMockRequest(testUserId);
      const result = await studentController.upsertProfile(PROFILE_BODY, req) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.name).toBe(PROFILE_BODY.name);
      expect(result.major).toBe(PROFILE_BODY.major);
    });

    it('동일 세션으로 다시 호출하면 갱신(upsert)되어야 함', async () => {
      const req1 = createMockRequest(testUserId);
      await studentController.upsertProfile(PROFILE_BODY, req1);

      const req2 = createMockRequest(testUserId);
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
    it('학적 정보가 없으면 404를 반환해야 함', async () => {
      const req = createMockRequest(testUserId);
      await studentController.getProfile(req);

      expect(studentController.getStatus()).toBe(404);
    });

    it('학적 정보가 있으면 200과 Student 도큐먼트를 반환해야 함', async () => {
      // 먼저 등록
      const upsertReq = createMockRequest(testUserId);
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      const req = createMockRequest(testUserId);
      const result = await studentController.getProfile(req) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.name).toBe(PROFILE_BODY.name);
    });
  });

  // ─── GET /student/me/academic-record ──────────────────────────────────────
  describe('getAcademicRecord', () => {
    it('Student가 없으면 404를 반환해야 함', async () => {
      const req = createMockRequest(testUserId);
      const result = await studentController.getAcademicRecord(req) as any;

      expect(studentController.getStatus()).toBe(404);
      expect(result.error).toBeDefined();
    });

    it('AcademicRecord가 없으면 404를 반환해야 함', async () => {
      // Student만 등록, AcademicRecord는 없음
      const upsertReq = createMockRequest(testUserId);
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      const req = createMockRequest(testUserId);
      await studentController.getAcademicRecord(req);

      expect(studentController.getStatus()).toBe(404);
    });

    it('AcademicRecord가 있으면 200을 반환해야 함', async () => {
      // Student 등록 + AcademicRecord 생성
      const upsertReq = createMockRequest(testUserId);
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      const student = await Student.findOne({ userId: new mongoose.Types.ObjectId(testUserId) });
      await AcademicRecord.create({
        studentId: student!._id,
        earnedCredits: { total: 80, majorCore: 20, majorAdvanced: 15, majorTotal: 35, generalElective: 30, socialService: 2, industry: 3 },
        secondMajorCredits: { majorTotal: 0, majorCore: 0 },
        completedConditions: { englishCourses: 1, pblTotal: 2, pblMajor: 1, hasPrerequisite: false, hasMandatoryCourse: false, hasThesis: false },
        takenCourses: [],
      });

      const req = createMockRequest(testUserId);
      const result = await studentController.getAcademicRecord(req) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.earnedCredits.total).toBe(80);
    });
  });

  // ─── PUT /student/me/academic-record ──────────────────────────────────────
  describe('updateAcademicRecord', () => {
    it('Student가 없으면 404를 반환해야 함', async () => {
      const req = createMockRequest(testUserId);
      const result = await studentController.updateAcademicRecord(
        { earnedCredits: { total: 50 } },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(404);
      expect(result.error).toBeDefined();
    });

    it('earnedCredits 수정 요청이 정상 처리되어야 함', async () => {
      // Student 등록
      const upsertReq = createMockRequest(testUserId);
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      const req = createMockRequest(testUserId);
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
    it('imageBase64가 비어있으면 400을 반환해야 함', async () => {
      const req = createMockRequest(testUserId);
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: '' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(400);
      expect(result.error).toBeDefined();
    });

    it('파싱 성공 시 200과 갱신된 AcademicRecord를 반환해야 함', async () => {
      // Student 등록
      const upsertReq = createMockRequest(testUserId);
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      mockParseGraduationRecord.mockResolvedValueOnce({
        isSuccess: true,
        confidence: 88,
        reason: '정상 파싱됨',
        academicRecord: { totalCredits: 105, majorCore: 34, majorAdvanced: 38, generalElective: 29 },
      });

      const req = createMockRequest(testUserId);
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: 'fakeBase64Data' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(200);
      expect(result.earnedCredits.total).toBe(105);
      expect(result.earnedCredits.majorCore).toBe(34);
    });

    it('VisionService가 isSuccess=false를 반환하면 422를 반환해야 함', async () => {
      const upsertReq = createMockRequest(testUserId);
      await studentController.upsertProfile(PROFILE_BODY, upsertReq);

      mockParseGraduationRecord.mockResolvedValueOnce({
        isSuccess: false,
        confidence: 20,
        reason: '화질 저하로 인식 불가',
      });

      const req = createMockRequest(testUserId);
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: 'fakeBase64Data' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(422);
      expect(result.error).toContain('화질 저하로 인식 불가');
    });

    it('Student 레코드가 없을 때 파싱 요청하면 404를 반환해야 함', async () => {
      const req = createMockRequest(testUserId);
      const result = await studentController.parseAndUpdateFromImage(
        { imageBase64: 'fakeBase64Data' },
        req
      ) as any;

      expect(studentController.getStatus()).toBe(404);
      expect(result.error).toBeDefined();

      // VisionService는 호출되지 않아야 함
      expect(mockParseGraduationRecord).not.toHaveBeenCalled();
    });
  });
});
