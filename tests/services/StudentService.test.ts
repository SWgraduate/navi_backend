// pnpm test -- tests/services/StudentService.test.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from 'src/models/Student';
import AcademicRecord from 'src/models/AcademicRecord';
import User from 'src/models/User';
import { StudentService } from 'src/services/StudentService';

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
jest.mock('src/services/VisionService', () => ({
  VisionService: jest.fn(),
}));

import { VisionService } from 'src/services/VisionService';
const MockedVisionService = jest.mocked(VisionService);

let mockParseGraduationRecord: jest.Mock;

// ─── 공통 픽스처 ──────────────────────────────────────────────────────────────
const PROFILE_DATA = {
  admissionYear: 2020,
  studentNumber: '2020123456',
  name: '홍길동',
  major: '컴퓨터공학부',
  secondMajorType: '선택' as const,
  academicStatus: '재학생' as const,
  completedSemesters: 6,
};

describe('StudentService Test', () => {
  let studentService: StudentService;
  let testUserId: string;

  beforeAll(async () => {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoURI);

    // 인덱스 보장
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
    // 각 테스트마다 임시 User 생성 후 userId 확보
    await User.deleteMany({});
    await Student.deleteMany({});
    await AcademicRecord.deleteMany({});

    const user = new User({ email: `test_${Date.now()}@example.com`, password: 'password123' });
    const savedUser = await user.save();
    testUserId = savedUser._id.toString();

    // 매 테스트마다 VisionService mock 인스턴스를 새로 세팅
    mockParseGraduationRecord = jest.fn();
    MockedVisionService.mockImplementation(() => ({
      parseGraduationRecord: mockParseGraduationRecord,
    }) as unknown as VisionService);

    studentService = new StudentService();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Student.deleteMany({});
    await AcademicRecord.deleteMany({});
  });

  // ─── upsertProfile ──────────────────────────────────────────────────────────
  describe('upsertProfile', () => {
    it('학적 기본정보가 없을 때 신규 생성(insert)되어야 함', async () => {
      const result = await studentService.upsertProfile(testUserId, PROFILE_DATA);

      expect(result).toBeDefined();
      expect(result.name).toBe(PROFILE_DATA.name);
      expect(result.major).toBe(PROFILE_DATA.major);
      expect(result.admissionYear).toBe(PROFILE_DATA.admissionYear);
      expect(result.studentNumber).toBe(PROFILE_DATA.studentNumber);
      expect(result.completedSemesters).toBe(PROFILE_DATA.completedSemesters);

      // DB 저장 확인
      const saved = await Student.findOne({ userId: new mongoose.Types.ObjectId(testUserId) });
      expect(saved).not.toBeNull();
      expect(saved?.name).toBe(PROFILE_DATA.name);
    });

    it('학적 기본정보가 이미 존재할 때 갱신(update)되어야 함', async () => {
      // 초기 데이터 삽입
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      // 수정 요청
      const updated = await studentService.upsertProfile(testUserId, {
        ...PROFILE_DATA,
        major: '소프트웨어학부',
        completedSemesters: 8,
      });

      expect(updated.major).toBe('소프트웨어학부');
      expect(updated.completedSemesters).toBe(8);

      // DB에 중복 레코드가 없는지 확인 (userId unique 조건)
      const count = await Student.countDocuments({ userId: new mongoose.Types.ObjectId(testUserId) });
      expect(count).toBe(1);
    });
  });

  // ─── getProfile ─────────────────────────────────────────────────────────────
  describe('getProfile', () => {
    it('학적 정보가 존재할 때 조회에 성공해야 함', async () => {
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      const result = await studentService.getProfile(testUserId);

      expect(result.name).toBe(PROFILE_DATA.name);
      expect(result.major).toBe(PROFILE_DATA.major);
    });

    it('학적 정보가 없을 때 에러를 throw해야 함', async () => {
      await expect(studentService.getProfile(testUserId))
        .rejects
        .toThrow('학적 정보가 존재하지 않습니다.');
    });
  });

  // ─── getAcademicRecord ──────────────────────────────────────────────────────
  describe('getAcademicRecord', () => {
    it('이수 현황이 존재할 때 조회에 성공해야 함', async () => {
      // Student 먼저 생성
      const student = await studentService.upsertProfile(testUserId, PROFILE_DATA);

      // AcademicRecord 직접 삽입
      await AcademicRecord.create({
        studentId: student.id,
        earnedCredits: { total: 90, majorCore: 30, majorAdvanced: 20, majorTotal: 50, generalElective: 30, socialService: 2, industry: 3 },
        secondMajorCredits: { majorTotal: 0, majorCore: 0 },
        completedConditions: { englishCourses: 1, pblTotal: 2, pblMajor: 1, hasPrerequisite: false, hasMandatoryCourse: false, hasThesis: false },
        takenCourses: [],
      });

      const result = await studentService.getAcademicRecord(testUserId);

      expect(result).toBeDefined();
      expect(result.earnedCredits.total).toBe(90);
    });

    it('Student 레코드가 없을 때 에러를 throw해야 함', async () => {
      await expect(studentService.getAcademicRecord(testUserId))
        .rejects
        .toThrow('학적 정보가 존재하지 않습니다');
    });

    it('AcademicRecord가 없을 때 에러를 throw해야 함', async () => {
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      await expect(studentService.getAcademicRecord(testUserId))
        .rejects
        .toThrow('이수 현황 정보가 존재하지 않습니다.');
    });
  });

  // ─── updateAcademicRecord ───────────────────────────────────────────────────
  describe('updateAcademicRecord', () => {
    it('earnedCredits 부분 업데이트가 정상적으로 반영되어야 함', async () => {
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      const result = await studentService.updateAcademicRecord(testUserId, {
        earnedCredits: { total: 100, majorCore: 33 },
      });

      expect(result.earnedCredits.total).toBe(100);
      expect(result.earnedCredits.majorCore).toBe(33);
      // 명시하지 않은 필드는 0(기본값) 유지
      expect(result.earnedCredits.generalElective).toBe(0);
    });

    it('completedConditions 업데이트가 정상적으로 반영되어야 함', async () => {
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      const result = await studentService.updateAcademicRecord(testUserId, {
        completedConditions: { englishCourses: 2, pblTotal: 3, pblMajor: 1 },
      });

      expect(result.completedConditions.englishCourses).toBe(2);
      expect(result.completedConditions.pblTotal).toBe(3);
    });

    it('takenCourses 전체 교체가 정상적으로 반영되어야 함', async () => {
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      const courses = [
        { courseCode: 'CSE1001', courseName: '자료구조', category: '전공핵심', credit: 3, isEnglish: false, isPbl: false, isMajorPbl: false },
        { courseCode: 'CSE2001', courseName: '운영체제', category: '전공핵심', credit: 3, isEnglish: true, isPbl: true, isMajorPbl: true },
      ];

      const result = await studentService.updateAcademicRecord(testUserId, { takenCourses: courses });

      expect(result.takenCourses).toHaveLength(2);
      expect(result.takenCourses[0]!.courseCode).toBe('CSE1001');
      expect(result.takenCourses[1]!.isEnglish).toBe(true);
    });

    it('Student 레코드가 없을 때 에러를 throw해야 함', async () => {
      await expect(studentService.updateAcademicRecord(testUserId, { earnedCredits: { total: 10 } }))
        .rejects
        .toThrow('학적 정보가 존재하지 않습니다');
    });
  });

  // ─── parseAndUpdateFromImage ────────────────────────────────────────────────
  describe('parseAndUpdateFromImage', () => {
    it('VisionService 파싱 성공 시 이수 현황이 자동 업데이트되어야 함', async () => {
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      mockParseGraduationRecord.mockResolvedValueOnce({
        isSuccess: true,
        confidence: 92,
        reason: '정상적인 졸업사정조회 표로 확인됨',
        academicRecord: {
          totalCredits: 110,
          majorCore: 36,
          majorAdvanced: 40,
          generalElective: 30,
        },
      });

      const result = await studentService.parseAndUpdateFromImage(testUserId, 'fakeBase64Image');

      expect(result.earnedCredits.total).toBe(110);
      expect(result.earnedCredits.majorCore).toBe(36);
      expect(result.earnedCredits.majorAdvanced).toBe(40);
      expect(result.earnedCredits.generalElective).toBe(30);

      expect(mockParseGraduationRecord).toHaveBeenCalledTimes(1);
      expect(mockParseGraduationRecord).toHaveBeenCalledWith('fakeBase64Image');
    });

    it('VisionService가 isSuccess=false를 반환하면 에러를 throw해야 함', async () => {
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      mockParseGraduationRecord.mockResolvedValueOnce({
        isSuccess: false,
        confidence: 30,
        reason: '화질이 너무 낮아 숫자를 읽을 수 없음',
      });

      await expect(studentService.parseAndUpdateFromImage(testUserId, 'fakeBase64Image'))
        .rejects
        .toThrow('이미지 파싱에 실패했습니다');
    });

    it('VisionService 시스템 에러 발생 시 그대로 전파되어야 함', async () => {
      await studentService.upsertProfile(testUserId, PROFILE_DATA);

      mockParseGraduationRecord.mockRejectedValueOnce(new Error('네트워크 오류'));

      await expect(studentService.parseAndUpdateFromImage(testUserId, 'fakeBase64Image'))
        .rejects
        .toThrow('네트워크 오류');
    });

    it('Student 레코드가 없을 때 VisionService 호출 전에 에러를 throw해야 함', async () => {
      await expect(studentService.parseAndUpdateFromImage(testUserId, 'fakeBase64Image'))
        .rejects
        .toThrow('학적 정보가 존재하지 않습니다');

      // VisionService는 호출되지 않아야 함
      expect(mockParseGraduationRecord).not.toHaveBeenCalled();
    });
  });
});
