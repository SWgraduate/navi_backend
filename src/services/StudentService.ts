import mongoose from 'mongoose';
import Student, { IStudent, SecondMajorType, AcademicStatus } from 'src/models/Student';
import AcademicRecord, { IAcademicRecord } from 'src/models/AcademicRecord';
import { VisionService } from 'src/services/VisionService';
import { logger } from 'src/utils/log';

// ─── Request / Response 인터페이스 ──────────────────────────────────────────

export interface UpsertProfileRequest {
  /**
   * 입학년도 (예: 2021)
   * @example 2021
   */
  admissionYear: number;
  /**
   * 학번 (예: "2021000000")
   * @example "2021
   * 00"
   */
  studentNumber: string;
  /**
   * 학생 성명
   * @example "홍길동"
   */
  name: string;
  /**
   * 주전공 (소속 학부/학과명)
   * @example "컴퓨터공학부"
   */
  major: string;
  /**
   * 제2전공 이수 유형 (없을 경우 '선택')
   * @example "선택"
   */
  secondMajorType: SecondMajorType;
  /**
   * 제2전공명 (다중전공 등 선택 상태가 아닐 때 한함)
   * @example "인공지능학과"
   */
  secondMajor?: string;
  /**
   * 현재 학적 상태
   * @example "재학생"
   */
  academicStatus: AcademicStatus;
  /**
   * 현재까지 이수 완료한 정규 등록 학기 수 (1~12)
   * @example 6
   */
  completedSemesters: number;
}

export interface StudentResponse {
  /**
   * 학적 레코드의 고유 식별자 (MongoDB ObjectId)
   */
  id: string;
  /**
   * 로그인한 사용자의 고유 식별자 (User 참조값)
   */
  userId: string;
  /**
   * 입학년도
   * @example 2021
   */
  admissionYear: number;
  /**
   * 학번
   * @example "2021000000"
   */
  studentNumber: string;
  /**
   * 학생 성명
   * @example "홍길동"
   */
  name: string;
  /**
   * 주전공 (소속 학부/학과명)
   * @example "컴퓨터공학부"
   */
  major: string;
  /**
   * 제2전공 이수 유형 (없을 경우 '선택')
   * @example "선택"
   */
  secondMajorType: SecondMajorType;
  /**
   * 제2전공명 (해당할 경우)
   */
  secondMajor?: string;
  /**
   * 현재 학적 상태
   * @example "재학생"
   */
  academicStatus: AcademicStatus;
  /**
   * 이수 완료 학기 수
   * @example 6
   */
  completedSemesters: number;
}


export interface EarnedCredits {
  /** 모든 이수학점의 총합 (졸업학점 기준과 비교) */
  total: number;
  /** 전공핵심 이수 학점 */
  majorCore: number;
  /** 전공심화 이수 학점 */
  majorAdvanced: number;
  /** 전공 계 (핵심 + 심화 + 기타 전공 학점 총합) */
  majorTotal: number;
  /** 교양선택 이수 학점 */
  generalElective: number;
  /** 사회봉사 이수 학점 (통상 1학점 P/F 과목) */
  socialService: number;
  /** 산학협력 영역 이수 학점 (캡스톤디자인 등 포함) */
  industry: number;
}

export interface SecondMajorCredits {
  /** 제2전공 전공학점 합계 */
  majorTotal: number;
  /** 제2전공 전공핵심 이수 학점 */
  majorCore: number;
}

export interface CompletedConditions {
  /** 영어전용강좌 이수 개수 */
  englishCourses: number;
  /** IC-PBL 강좌 전체 이수 개수 */
  pblTotal: number;
  /** 전공 IC-PBL 강좌 이수 개수 */
  pblMajor: number;
  /** 선수강 이수 완료 여부 */
  hasPrerequisite: boolean;
  /** 미필과목 이수 완료 여부 */
  hasMandatoryCourse: boolean;
  /** 졸업논문/졸업시험/졸업작품 통과 여부 */
  hasThesis: boolean;
}

export interface TakenCourse {
  courseCode: string;
  courseName: string;
  category: string;
  credit: number;
  isEnglish: boolean;
  isPbl: boolean;
  isMajorPbl: boolean;
}

export interface UpdateAcademicRecordRequest {
  earnedCredits?: Partial<EarnedCredits>;
  secondMajorCredits?: Partial<SecondMajorCredits>;
  completedConditions?: Partial<CompletedConditions>;
  takenCourses?: TakenCourse[];
}

export interface AcademicRecordResponse {
  id: string;
  studentId: string;
  earnedCredits: EarnedCredits;
  secondMajorCredits: SecondMajorCredits;
  completedConditions: CompletedConditions;
  takenCourses: TakenCourse[];
}

// ─── StudentService ──────────────────────────────────────────────────────────

export class StudentService {
  private visionService = new VisionService();

  /**
   * 학적 기본정보 등록/수정 (upsert)
   * userId 기준으로 문서가 없으면 생성, 있으면 덮어씀.
   */
  public async upsertProfile(
    userId: string,
    data: UpsertProfileRequest
  ): Promise<StudentResponse> {
    logger.i(`StudentService: 학적 정보 upsert 요청 (userId=${userId})`);

    const updated = await Student.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { ...data, userId: new mongoose.Types.ObjectId(userId) },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    return {
      id: updated!._id.toString(),
      userId: updated!.userId.toString(),
      admissionYear: updated!.admissionYear,
      studentNumber: updated!.studentNumber,
      name: updated!.name,
      major: updated!.major,
      secondMajorType: updated!.secondMajorType,
      secondMajor: updated!.secondMajor,
      academicStatus: updated!.academicStatus,
      completedSemesters: updated!.completedSemesters,
    };
  }

  /**
   * 학적 기본정보 조회
   */
  public async getProfile(userId: string): Promise<StudentResponse> {
    logger.i(`StudentService: 학적 정보 조회 (userId=${userId})`);

    const student = await Student.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!student) {
      throw new Error('학적 정보가 존재하지 않습니다. 먼저 학적 정보를 등록해주세요.');
    }

    return {
      id: student._id.toString(),
      userId: student.userId.toString(),
      admissionYear: student.admissionYear,
      studentNumber: student.studentNumber,
      name: student.name,
      major: student.major,
      secondMajorType: student.secondMajorType,
      secondMajor: student.secondMajor,
      academicStatus: student.academicStatus,
      completedSemesters: student.completedSemesters,
    };
  }

  /**
   * 이수 현황 조회
   * Student 레코드가 선행되어야 함.
   */
  public async getAcademicRecord(userId: string): Promise<AcademicRecordResponse> {
    logger.i(`StudentService: 이수 현황 조회 (userId=${userId})`);

    const student = await this._requireStudent(userId);

    const record = await AcademicRecord.findOne({ studentId: student._id });

    if (!record) {
      throw new Error('이수 현황 정보가 존재하지 않습니다.');
    }

    return {
      id: record._id.toString(),
      studentId: record.studentId.toString(),
      earnedCredits: record.earnedCredits,
      secondMajorCredits: record.secondMajorCredits,
      completedConditions: record.completedConditions,
      takenCourses: record.takenCourses as unknown as TakenCourse[],
    };
  }

  /**
   * 이수 현황 직접 수정 (부분 업데이트)
   */
  public async updateAcademicRecord(
    userId: string,
    data: UpdateAcademicRecordRequest
  ): Promise<AcademicRecordResponse> {
    logger.i(`StudentService: 이수 현황 직접 수정 (userId=${userId})`);

    const student = await this._requireStudent(userId);

    const updatePayload: Record<string, unknown> = {};
    if (data.earnedCredits) {
      for (const [key, val] of Object.entries(data.earnedCredits)) {
        updatePayload[`earnedCredits.${key}`] = val;
      }
    }
    if (data.secondMajorCredits) {
      for (const [key, val] of Object.entries(data.secondMajorCredits)) {
        updatePayload[`secondMajorCredits.${key}`] = val;
      }
    }
    if (data.completedConditions) {
      for (const [key, val] of Object.entries(data.completedConditions)) {
        updatePayload[`completedConditions.${key}`] = val;
      }
    }
    if (data.takenCourses !== undefined) {
      updatePayload['takenCourses'] = data.takenCourses;
    }

    const updated = await AcademicRecord.findOneAndUpdate(
      { studentId: student._id },
      { $set: updatePayload },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    return {
      id: updated!._id.toString(),
      studentId: updated!.studentId.toString(),
      earnedCredits: updated!.earnedCredits,
      secondMajorCredits: updated!.secondMajorCredits,
      completedConditions: updated!.completedConditions,
      takenCourses: updated!.takenCourses as unknown as TakenCourse[],
    };
  }

  /**
   * 졸업사정표 이미지 파싱 후 이수 현황 자동 업데이트
   * VisionService를 통해 이미지를 분석하고, academicRecord 필드만 추출하여 반영함.
   */
  public async parseAndUpdateFromImage(
    userId: string,
    imageBase64: string
  ): Promise<AcademicRecordResponse> {
    logger.i(`StudentService: 이미지 파싱 기반 이수 현황 업데이트 (userId=${userId})`);

    const student = await this._requireStudent(userId);

    // VisionService 호출
    const visionResult = await this.visionService.parseGraduationRecord(imageBase64);

    if (!visionResult.isSuccess || !visionResult.academicRecord) {
      throw new Error(
        `이미지 파싱에 실패했습니다. 사유: ${visionResult.reason ?? '알 수 없음'}`
      );
    }

    const {
      totalCredits, majorCore, majorAdvanced, generalElective,
      secondMajorTotal, secondMajorCore,
      hasPrerequisite, hasMandatoryCourse, hasThesis,
    } = visionResult.academicRecord;

    const earnedPartial: Partial<EarnedCredits> = {};
    if (totalCredits !== undefined) earnedPartial.total = totalCredits;
    if (majorCore !== undefined) earnedPartial.majorCore = majorCore;
    if (majorAdvanced !== undefined) earnedPartial.majorAdvanced = majorAdvanced;
    if (generalElective !== undefined) earnedPartial.generalElective = generalElective;

    const secondMajorPartial: Partial<SecondMajorCredits> = {};
    if (secondMajorTotal !== undefined) secondMajorPartial.majorTotal = secondMajorTotal;
    if (secondMajorCore !== undefined) secondMajorPartial.majorCore = secondMajorCore;

    const conditionsPartial: Partial<CompletedConditions> = {};
    if (hasPrerequisite !== undefined) conditionsPartial.hasPrerequisite = hasPrerequisite;
    if (hasMandatoryCourse !== undefined) conditionsPartial.hasMandatoryCourse = hasMandatoryCourse;
    if (hasThesis !== undefined) conditionsPartial.hasThesis = hasThesis;

    const updatePayload: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(earnedPartial)) {
      updatePayload[`earnedCredits.${key}`] = val;
    }
    for (const [key, val] of Object.entries(secondMajorPartial)) {
      updatePayload[`secondMajorCredits.${key}`] = val;
    }
    for (const [key, val] of Object.entries(conditionsPartial)) {
      updatePayload[`completedConditions.${key}`] = val;
    }

    const updated = await AcademicRecord.findOneAndUpdate(
      { studentId: student._id },
      { $set: updatePayload },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    logger.i(
      `StudentService: 이미지 파싱 완료 및 이수 현황 업데이트 성공 (신뢰도: ${visionResult.confidence}%)`
    );

    return {
      id: updated!._id.toString(),
      studentId: updated!.studentId.toString(),
      earnedCredits: updated!.earnedCredits,
      secondMajorCredits: updated!.secondMajorCredits,
      completedConditions: updated!.completedConditions,
      takenCourses: updated!.takenCourses as unknown as TakenCourse[],
    };
  }

  // ─── Private 헬퍼 ────────────────────────────────────────────────────────

  /** userId로 Student 문서를 조회하며, 없으면 에러를 throw함 */
  private async _requireStudent(userId: string): Promise<IStudent> {
    const student = await Student.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!student) {
      throw new Error('학적 정보가 존재하지 않습니다. 먼저 학적 기본정보를 등록해주세요.');
    }

    return student;
  }
}
