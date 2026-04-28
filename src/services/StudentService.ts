import mongoose from 'mongoose';
import { AcademicRecordNotFoundError, ImageParsingError, InvalidMajorError, StudentNotFoundError } from 'src/errors/StudentErrors';
import AcademicRecord from 'src/models/AcademicRecord';
import Course, { ICourse } from 'src/models/Course';
import Major from 'src/models/Major';
import Student, { AcademicStatus, ISecondMajorInfo, IStudent } from 'src/models/Student';
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
   * 제2전공 정보 (없을 경우 null)
   */
  secondMajorInfo?: ISecondMajorInfo | null;
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
  /**
   * 편입생 여부 (true인 경우 3학년 편입 기준 졸업요건 적용)
   */
  isTransfer?: boolean;
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
   * 제2전공 정보 (없을 경우 null)
   */
  secondMajorInfo?: ISecondMajorInfo | null;
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
  /**
   * 편입생 여부
   */
  isTransfer?: boolean;
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
  updateMessages?: string[];
}

export interface ParseAndUpdateResponse extends AcademicRecordResponse {
  updateMessages?: string[];
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

    // Major DB가 비어있지 않은 경우에만 유효성 검사 수행 (시딩 전 환경 대비)
    const majorCount = await Major.estimatedDocumentCount();
    if (majorCount > 0) {
      const majorExists = await Major.exists({ name: data.major });
      if (!majorExists) {
        throw new InvalidMajorError(data.major);
      }

      if (data.secondMajorInfo?.name) {
        const secondMajorExists = await Major.exists({ name: data.secondMajorInfo.name });
        if (!secondMajorExists) {
          throw new InvalidMajorError(data.secondMajorInfo.name);
        }
      }
    }

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
      secondMajorInfo: updated.secondMajorInfo,
      academicStatus: updated.academicStatus,
      completedSemesters: updated.completedSemesters,
      isTransfer: updated.isTransfer,
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
      secondMajorInfo: student.secondMajorInfo,
      academicStatus: student.academicStatus,
      completedSemesters: student.completedSemesters,
      isTransfer: student.isTransfer,
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
  ): Promise<ParseAndUpdateResponse> {
    logger.i(`StudentService: 이미지 파싱 기반 이수 현황 업데이트 (userId=${userId})`);

    const student = await this._requireStudent(userId);

    // 업데이트 전 기존 데이터 조회 (비교용)
    const oldRecord = await AcademicRecord.findOne({ studentId: student._id }).lean();

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

    // 변경점 비교 로직
    const updateMessages: string[] = [];
    if (!oldRecord) {
      updateMessages.push("이수 현황 정보가 새로 등록되었어요.");
    } else {
      const fieldMap: Record<string, string> = {
        'earnedCredits.total': '졸업학점',
        'earnedCredits.majorTotal': '전공학점',
        'earnedCredits.majorCore': '전공핵심',
        'earnedCredits.majorAdvanced': '전공심화',
        'earnedCredits.generalElective': '교양선택',
        'earnedCredits.socialService': '사회봉사',
        'earnedCredits.industry': '산학협력영역',
        'secondMajorCredits.majorTotal': '다중전공 전공학점',
        'secondMajorCredits.majorCore': '다중전공 전공핵심',
        'earnedCredits.gpa': '전체 평점', // 비교를 위해 추가 가능
      };

      for (const [dotPath, label] of Object.entries(fieldMap)) {
        const parts = dotPath.split('.');
        const newVal = parts.reduce((obj: any, key) => obj?.[key], updated);
        const oldVal = parts.reduce((obj: any, key) => obj?.[key], oldRecord);

        // 숫자 타입이 유효하며 서로 다를 때만 기록
        if (typeof newVal === 'number' && typeof oldVal === 'number' && newVal !== oldVal) {
          updateMessages.push(`${label}이(가) ${oldVal}학점에서 ${newVal}학점으로 업데이트 되었어요.`);
        }
      }
    }

    return {
      id: updated._id.toString(),
      studentId: updated.studentId.toString(),
      earnedCredits: updated.earnedCredits as EarnedCredits,
      secondMajorCredits: updated.secondMajorCredits as SecondMajorCredits,
      completedConditions: updated.completedConditions as CompletedConditions,
      takenCourses: updated.takenCourses as TakenCourse[],
      updateMessages,
    };
  }

  /**
   * 시간표 이미지 파싱 및 학사 정보 종합 업데이트 처리 API
   * 
   * 1. VisionService로 Base64 이미지를 분석해 과목명/시간을 추출.
   * 2. 인식된 과목을 Course 컬렉션과 매칭하여 실제 과목 데이터(ICourse)로 변환.
   * 3. 기존 AcademicRecord의 takenCourses에 없는 신규 과목만 선별하여 추가.
   * 4. 신규 추가된 과목들의 정보(credit, category, isEnglish, isPbl 등)를 바탕으로
   *    총 졸업학점, 전공/교양별 학점, 특수 이수조건(영어, PBL 카운트) 등의 숫자 필드를 함께 증가시킴.
   * 5. 프론트엔드가 결과를 알림으로 보여줄 수 있도록 상세한 업데이트 내용(updateMessages)을 반환함.
   */
  public async parseTimetableAndUpdate(
    userId: string,
    imageBase64: string
  ): Promise<ParseAndUpdateResponse> {
    logger.i(`StudentService: 시간표 이미지 파싱 기반 추출 및 업데이트 (userId=${userId})`);

    const student = await this._requireStudent(userId);
    let oldRecord = await AcademicRecord.findOne({ studentId: student._id }).lean();

    // 이수 현황 레코드가 아예 없는 경우 초기화
    if (!oldRecord) {
      const initDoc = await AcademicRecord.create({
        studentId: student._id,
        earnedCredits: { total: 0, majorTotal: 0, majorCore: 0, majorAdvanced: 0, generalElective: 0, socialService: 0, industry: 0, gpa: 0 },
        secondMajorCredits: { majorTotal: 0, majorCore: 0 },
        completedConditions: { hasPrerequisite: false, hasMandatoryCourse: false, hasThesis: false, englishCourses: 0, pblTotal: 0, pblMajor: 0 },
        takenCourses: []
      });
      oldRecord = initDoc.toObject();
    }

    let updatedRecord = oldRecord;

    const visionResult = await this.visionService.parseTimetable(imageBase64);

    if (!visionResult.isSuccess) {
      throw new ImageParsingError(visionResult.reason || undefined);
    }

    let mappedCourses: ICourse[] = [];
    const updateMessages: string[] = [];

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
          courseName: { $regex: `^${regexStr}$`, $options: 'i' }
        };

        const candidates = await Course.find(query).lean();

        if (candidates.length > 0) {
          // 시간이 없거나 비교하기 복잡한 경우 우선 첫 번째 과목 선택
          // 고도화 시 parsed.time과 candidate.classTimes 간의 유사도 등 추가 가능
          let bestMatch = candidates[0];

          if (parsed.time && candidates.length > 1) {
            // 시간 정보가 포함된 과목 우선순위 매핑 로직 (단순 문자열 포함 여부 체크)
            // 예: "화(09:00" 같은 일부 패턴이라도 포함되어 있는지 확인
            const matchedByTime = candidates.find(c => c.classTimes && c.classTimes.replace(/\s+/g, '').includes(parsed.time.substring(0, 2)));
            if (matchedByTime) {
              bestMatch = matchedByTime;
            }
          }

          mappedCourses.push(bestMatch as unknown as ICourse);
        } else {
          logger.w(`StudentService: 매핑 실패 - ${parsed.name} (${parsed.time})`);
        }
      }

      // DB 업데이트 로직 시작
      if (mappedCourses.length > 0) {
        let addedCourseNames: string[] = [];
        const existingCodes = new Set(oldRecord?.takenCourses?.map(c => c.courseCode) || []);

        const newTakenCourses = mappedCourses
          .filter(c => {
            if (existingCodes.has(c.courseCode)) return false;
            existingCodes.add(c.courseCode); // 중복 추가 방지
            addedCourseNames.push(c.courseName);
            return true;
          })
          .map(c => ({
            courseCode: c.courseCode,
            courseName: c.courseName,
            category: c.category,
            credit: c.credit,
            isEnglish: c.isEnglish,
            isPbl: c.isPbl,
            isMajorPbl: c.isMajorPbl
          }));

        if (newTakenCourses.length > 0) {
          const incPayload: Record<string, number> = {};

          for (const c of newTakenCourses) {
            incPayload['earnedCredits.total'] = (incPayload['earnedCredits.total'] || 0) + c.credit;

            const type = c.category || '';
            if (type.includes('전공') || type.includes('전핵') || type.includes('전심')) {
              incPayload['earnedCredits.majorTotal'] = (incPayload['earnedCredits.majorTotal'] || 0) + c.credit;
              if (type.includes('핵심') || type.includes('전핵')) {
                incPayload['earnedCredits.majorCore'] = (incPayload['earnedCredits.majorCore'] || 0) + c.credit;
              } else if (type.includes('심화') || type.includes('전심')) {
                incPayload['earnedCredits.majorAdvanced'] = (incPayload['earnedCredits.majorAdvanced'] || 0) + c.credit;
              }
            } else if (type.includes('교양') || type.includes('일교') || type.includes('핵교')) {
              incPayload['earnedCredits.generalElective'] = (incPayload['earnedCredits.generalElective'] || 0) + c.credit;
            } else if (type.includes('봉사')) {
              incPayload['earnedCredits.socialService'] = (incPayload['earnedCredits.socialService'] || 0) + c.credit;
            } else if (type.includes('산학')) {
              incPayload['earnedCredits.industry'] = (incPayload['earnedCredits.industry'] || 0) + c.credit;
            }

            if (c.isEnglish) {
              incPayload['completedConditions.englishCourses'] = (incPayload['completedConditions.englishCourses'] || 0) + 1;
            }
            if (c.isPbl || c.isMajorPbl) {
              incPayload['completedConditions.pblTotal'] = (incPayload['completedConditions.pblTotal'] || 0) + 1;
            }
            if (c.isMajorPbl) {
              incPayload['completedConditions.pblMajor'] = (incPayload['completedConditions.pblMajor'] || 0) + 1;
            }
          }

          const updateQuery: any = {
            $push: { takenCourses: { $each: newTakenCourses } },
          };
          if (Object.keys(incPayload).length > 0) {
            updateQuery.$inc = incPayload;
          }

          const rawDoc = await AcademicRecord.findOneAndUpdate(
            { studentId: student._id },
            updateQuery,
            { upsert: true, returnDocument: 'after' }
          );

          if (rawDoc) updatedRecord = rawDoc.toObject();

          if (addedCourseNames.length <= 3) {
            updateMessages.push(`수강 목록에 ${addedCourseNames.join(', ')} 과목이 추가되었어요.`);
          } else {
            const firstTwo = addedCourseNames.slice(0, 2).join(', ');
            updateMessages.push(`수강 목록에 ${firstTwo} 등 총 ${addedCourseNames.length}과목이 추가되었어요.`);
          }

          // 변경된 학점 및 조건 내역 메시지 생성
          const fieldMap: Record<string, { label: string, unit: string }> = {
            'earnedCredits.total': { label: '졸업학점', unit: '학점' },
            'earnedCredits.majorTotal': { label: '전공학점', unit: '학점' },
            'earnedCredits.majorCore': { label: '전공핵심', unit: '학점' },
            'earnedCredits.majorAdvanced': { label: '전공심화', unit: '학점' },
            'earnedCredits.generalElective': { label: '교양학점', unit: '학점' },
            'earnedCredits.socialService': { label: '사회봉사', unit: '학점' },
            'earnedCredits.industry': { label: '산학협력영역', unit: '학점' },
            'completedConditions.englishCourses': { label: '영어전용강좌', unit: '과목' },
            'completedConditions.pblTotal': { label: 'IC-PBL강좌', unit: '과목' },
            'completedConditions.pblMajor': { label: '전공 IC-PBL강좌', unit: '과목' },
          };

          for (const [dotPath, meta] of Object.entries(fieldMap)) {
            const parts = dotPath.split('.');
            const newVal = parts.reduce((obj: any, key) => obj?.[key], updatedRecord);
            const oldVal = parts.reduce((obj: any, key) => obj?.[key], oldRecord) || 0;

            if (typeof newVal === 'number' && typeof oldVal === 'number' && newVal > oldVal) {
              updateMessages.push(`${meta.label}이(가) ${oldVal}${meta.unit}에서 ${newVal}${meta.unit}으로 올랐어요.`);
            }
          }
        } else {
          updateMessages.push('이미 수강 목록에 있는 과목들이라 새롭게 추가된 과목은 없어요.');
        }
      } else {
        updateMessages.push('시간표에서 학수번호 매핑이 가능한 과목을 찾지 못했어요.');
      }
    } else {
      updateMessages.push('시간표에서 인식된 과목이 없어요.');
    }

    return {
      id: updatedRecord._id.toString(),
      studentId: updatedRecord.studentId.toString(),
      earnedCredits: updatedRecord.earnedCredits as EarnedCredits,
      secondMajorCredits: updatedRecord.secondMajorCredits as SecondMajorCredits,
      completedConditions: updatedRecord.completedConditions as CompletedConditions,
      takenCourses: updatedRecord.takenCourses as TakenCourse[],
      updateMessages
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

  /**
   * 주어진 userId의 학적 정보를 LLM 시스템 프롬프트 주입용 텍스트로 직렬화하여 반환합니다.
   * 학적 정보가 없거나 userId가 없는 경우 null을 반환하여 graceful fallback을 지원합니다.
   *
   * @param userId - 학적 정보를 조회할 사용자의 ID
   * @returns 시스템 프롬프트에 삽입할 개인 학사 컨텍스트 문자열, 또는 null
   */
  public async getAcademicContextString(userId: string): Promise<string | null> {
    try {
      const student = await Student.findOne({
        userId: new mongoose.Types.ObjectId(userId),
      }).lean();

      if (!student) return null;

      const record = await AcademicRecord.findOne({ studentId: student._id }).lean();

      if (!record) return null;

      const { earnedCredits: ec, secondMajorCredits: sm, completedConditions: cc } = record;

      const lines: string[] = [
        `이름: ${student.name}`,
        `학번: ${student.studentNumber} (${student.admissionYear}학번)`,
        `주전공: ${student.major}`,
        student.secondMajorInfo
          ? `제2전공: ${student.secondMajorInfo.type} - ${student.secondMajorInfo.name}`
          : `제2전공: 없음`,
        `학적 상태: ${student.academicStatus} (이수 학기: ${student.completedSemesters}학기)`,
        ``,
        `[이수 학점 현황]`,
        `- GPA: ${ec.gpa}`,
        `- 총 이수 학점: ${ec.total}학점`,
        `- 전공 계: ${ec.majorTotal}학점 (핵심 ${ec.majorCore} / 심화 ${ec.majorAdvanced})`,
        `- 교양선택: ${ec.generalElective}학점`,
        `- 사회봉사: ${ec.socialService}학점`,
        `- 산학협력: ${ec.industry}학점`,
      ];

      if (sm.majorTotal > 0 || sm.majorCore > 0) {
        lines.push(`- 제2전공 학점 계: ${sm.majorTotal}학점 (핵심 ${sm.majorCore})`);
      }

      lines.push(
        ``,
        `[특수 이수 조건]`,
        `- 영어전용강좌 이수: ${cc.englishCourses}과목`,
        `- IC-PBL 강좌 이수: ${cc.pblTotal}과목 (전공 PBL ${cc.pblMajor}과목)`,
        `- 선수강 이수: ${cc.hasPrerequisite ? '완료' : '미완료'}`,
        `- 미필과목 이수: ${cc.hasMandatoryCourse ? '완료' : '미완료'}`,
        `- 졸업논문/시험/작품: ${cc.hasThesis ? '통과' : '미통과'}`,
      );

      return lines.join('\n');
    } catch (err) {
      logger.w(`StudentService.getAcademicContextString: 학적 컨텍스트 조회 실패 (userId=${userId})`, err);
      return null;
    }
  }
}
