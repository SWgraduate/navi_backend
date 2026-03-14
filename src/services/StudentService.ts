import mongoose from 'mongoose';
import Student, { IStudent, SecondMajorType, AcademicStatus } from 'src/models/Student';
import AcademicRecord, { IAcademicRecord } from 'src/models/AcademicRecord';
import { VisionService } from 'src/services/VisionService';
import { logger } from 'src/utils/log';

// ─── Request / Response 인터페이스 ──────────────────────────────────────────

export interface UpsertProfileRequest {
  admissionYear: number;
  name: string;
  major: string;
  secondMajorType: SecondMajorType;
  secondMajor?: string;
  academicStatus: AcademicStatus;
  completedSemesters: number;
}

export interface StudentResponse {
  id: string;
  userId: string;
  admissionYear: number;
  name: string;
  major: string;
  secondMajorType: SecondMajorType;
  secondMajor?: string;
  academicStatus: AcademicStatus;
  completedSemesters: number;
}


export interface EarnedCredits {
  total: number;
  majorCore: number;
  majorAdvanced: number;
  majorTotal: number;
  generalElective: number;
  socialService: number;
  industry: number;
}

export interface CompletedConditions {
  englishCourses: number;
  pblTotal: number;
  pblMajor: number;
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
  completedConditions?: Partial<CompletedConditions>;
  takenCourses?: TakenCourse[];
}

export interface AcademicRecordResponse {
  id: string;
  studentId: string;
  earnedCredits: EarnedCredits;
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

    const { totalCredits, majorCore, majorAdvanced, generalElective } =
      visionResult.academicRecord;

    const partial: Partial<EarnedCredits> = {};
    if (totalCredits !== undefined) partial.total = totalCredits;
    if (majorCore !== undefined) partial.majorCore = majorCore;
    if (majorAdvanced !== undefined) partial.majorAdvanced = majorAdvanced;
    if (generalElective !== undefined) partial.generalElective = generalElective;

    const updatePayload: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(partial)) {
      updatePayload[`earnedCredits.${key}`] = val;
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
