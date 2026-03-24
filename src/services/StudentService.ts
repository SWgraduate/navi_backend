import mongoose from 'mongoose';
import { AcademicRecordNotFoundError, ImageParsingError, StudentNotFoundError } from 'src/errors/StudentErrors';
import AcademicRecord from 'src/models/AcademicRecord';
import Student, { AcademicStatus, IStudent, SecondMajorType } from 'src/models/Student';
import Course, { ICourse } from 'src/models/Course';
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
   * 제2전공 이수 유형 (없을 경우 '없음')
   * @example "없음"
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
   * 제2전공 이수 유형 (없을 경우 '없음')
   * @example "없음"
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
  /** 취득 총 평점 (GPA) */
  gpa?: number;
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
  /** 이수 현황 레코드 고유 ID */
  id: string;
  /** 해당 이수 현황을 소유한 학생의 고유 ID */
  studentId: string;
  /** 주전공 및 공통 영역 이수 학점 세부 내역 */
  earnedCredits: EarnedCredits;
  /** 제2전공 이수 학점 세부 내역 */
  secondMajorCredits: SecondMajorCredits;
  /** 특수 요건(영어, PBL, 선수강 등) 이수 상태 */
  completedConditions: CompletedConditions;
  /** 수강 완료한 개별 과목 목록 */
  takenCourses: TakenCourse[];
}

export interface ParsedCourse {
  name: string;
  time: string;
}

export interface ParseTimetableResponse {
  isSuccess: boolean;
  confidence: number;
  reason: string;
  courses?: ICourse[]; // ICourse is from Course model
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

    if (!updated) {
      throw new Error('학적 정보를 업데이트하거나 생성하는 데 실패했습니다.');
    }

    return {
      id: updated._id.toString(),
      userId: updated.userId.toString(),
      admissionYear: updated.admissionYear,
      studentNumber: updated.studentNumber,
      name: updated.name,
      major: updated.major,
      secondMajorType: updated.secondMajorType,
      secondMajor: updated.secondMajor,
      academicStatus: updated.academicStatus,
      completedSemesters: updated.completedSemesters,
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
      throw new StudentNotFoundError();
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

    const record = await AcademicRecord.findOne({ studentId: student._id }).lean();

    if (!record) {
      throw new AcademicRecordNotFoundError();
    }

    return {
      id: record._id.toString(),
      studentId: record.studentId.toString(),
      earnedCredits: record.earnedCredits as EarnedCredits,
      secondMajorCredits: record.secondMajorCredits as SecondMajorCredits,
      completedConditions: record.completedConditions as CompletedConditions,
      takenCourses: record.takenCourses as TakenCourse[],
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

    const rawDoc = await AcademicRecord.findOneAndUpdate(
      { studentId: student._id },
      { $set: updatePayload },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    
    if (!rawDoc) {
      throw new Error('이수 현황 정보를 업데이트하거나 생성하는 데 실패했습니다.');
    }
    const updated = rawDoc.toObject();

    return {
      id: updated._id.toString(),
      studentId: updated.studentId.toString(),
      earnedCredits: updated.earnedCredits as EarnedCredits,
      secondMajorCredits: updated.secondMajorCredits as SecondMajorCredits,
      completedConditions: updated.completedConditions as CompletedConditions,
      takenCourses: updated.takenCourses as TakenCourse[],
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
      throw new ImageParsingError(visionResult.reason || undefined);
    }

    const {
      gpa,
      totalCredits, majorTotal, majorCore, majorAdvanced, generalElective, socialService, industry,
      secondMajorTotal, secondMajorCore,
      hasPrerequisite, hasMandatoryCourse, hasThesis,
      englishCourses, pblTotal, pblMajor
    } = visionResult.academicRecord;

    const earnedPartial: Partial<EarnedCredits> = {};
    if (gpa != null) earnedPartial.gpa = gpa;
    if (totalCredits != null) earnedPartial.total = totalCredits;
    if (majorTotal != null) earnedPartial.majorTotal = majorTotal;
    if (majorCore != null) earnedPartial.majorCore = majorCore;
    if (majorAdvanced != null) earnedPartial.majorAdvanced = majorAdvanced;
    if (generalElective != null) earnedPartial.generalElective = generalElective;
    if (socialService != null) earnedPartial.socialService = socialService;
    if (industry != null) earnedPartial.industry = industry;

    const secondMajorPartial: Partial<SecondMajorCredits> = {};
    if (secondMajorTotal != null) secondMajorPartial.majorTotal = secondMajorTotal;
    if (secondMajorCore != null) secondMajorPartial.majorCore = secondMajorCore;

    const conditionsPartial: Partial<CompletedConditions> = {};
    if (hasPrerequisite != null) conditionsPartial.hasPrerequisite = hasPrerequisite;
    if (hasMandatoryCourse != null) conditionsPartial.hasMandatoryCourse = hasMandatoryCourse;
    if (hasThesis != null) conditionsPartial.hasThesis = hasThesis;
    if (englishCourses != null) conditionsPartial.englishCourses = englishCourses;
    if (pblTotal != null) conditionsPartial.pblTotal = pblTotal;
    if (pblMajor != null) conditionsPartial.pblMajor = pblMajor;

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

    const rawDoc = await AcademicRecord.findOneAndUpdate(
      { studentId: student._id },
      { $set: updatePayload },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    
    if (!rawDoc) {
      throw new Error('이수 현황 정보를 업데이트하거나 생성하는 데 실패했습니다.');
    }
    const updated = rawDoc.toObject();

    logger.i(
      `StudentService: 이미지 파싱 완료 및 이수 현황 업데이트 성공 (신뢰도: ${visionResult.confidence}%)`
    );

    return {
      id: updated._id.toString(),
      studentId: updated.studentId.toString(),
      earnedCredits: updated.earnedCredits as EarnedCredits,
      secondMajorCredits: updated.secondMajorCredits as SecondMajorCredits,
      completedConditions: updated.completedConditions as CompletedConditions,
      takenCourses: updated.takenCourses as TakenCourse[],
    };
  }

  /**
   * 시간표 이미지 파싱 API
   * 인식된 과목명과 시간을 바탕으로 DB에서 매핑된 과목 목록을 찾아 반환.
   */
  public async parseTimetableFromImage(
    userId: string,
    imageBase64: string
  ): Promise<ParseTimetableResponse> {
    logger.i(`StudentService: 시간표 이미지 파싱 기반 추출 (userId=${userId})`);

    await this._requireStudent(userId);

    const visionResult = await this.visionService.parseTimetable(imageBase64);

    if (!visionResult.isSuccess) {
      throw new ImageParsingError(visionResult.reason || undefined);
    }

    let mappedCourses: ICourse[] = [];

    if (visionResult.courses && visionResult.courses.length > 0) {
      logger.i(`StudentService: 추출된 과목 수: ${visionResult.courses.length}. DB 매핑 시작...`);
      for (const parsed of visionResult.courses) {
        // 과목명 정규식 메타문자 이스케이프 및 공백 무시 검색 처리
        const cleanName = parsed.name.replace(/\s+/g, '');
        const regexStr = cleanName
          .split('')
          .map((c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\s*');

        const query = {
          $and: [
            { courseName: { $regex: regexStr, $options: 'i' } }
          ]
        };

        const candidates = await Course.find(query).lean();

        if (candidates.length > 0) {
          // 시간이 없거나 비교하기 복잡한 경우 우선 첫 번째 과목 선택
          // 고도화 시 parsed.time과 candidate.classTimes 간의 유사도 등 추가 가능
          let bestMatch = candidates[0];
          
          if (parsed.time && candidates.length > 1) {
            // 시간 정보가 포함된 과목 우선순위 매핑 로직 (단순 문자열 포함 여부 체크)
            // 예: "화(09:00" 같은 일부 패턴이라도 포함되어 있는지 확인
            const matchedByTime = candidates.find(c => c.classTimes && c.classTimes.replace(/\s+/g,'').includes(parsed.time.substring(0, 2)));
            if (matchedByTime) {
              bestMatch = matchedByTime;
            }
          }

          mappedCourses.push(bestMatch as unknown as ICourse);
        } else {
          logger.w(`StudentService: 매핑 실패 - ${parsed.name} (${parsed.time})`);
        }
      }
    }

    return {
      isSuccess: visionResult.isSuccess,
      confidence: visionResult.confidence,
      reason: visionResult.reason,
      courses: mappedCourses
    };
  }

  // ─── Private 헬퍼 ────────────────────────────────────────────────────────

  /** userId로 Student 문서를 조회하며, 없으면 에러를 throw함 */
  private async _requireStudent(userId: string): Promise<IStudent> {
    const student = await Student.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!student) {
      throw new StudentNotFoundError();
    }

    return student;
  }
}
