import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicRecord extends Document {
  /** 어떤 학생의 기록인지 (Student 컬렉션 참조) */
  studentId: mongoose.Types.ObjectId;

  // 1. 주전공(제1전공) 이수 학점 요약
  earnedCredits: {
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
    /** 사회봉사 이수 학점 (통상 1학점 P/F 과목으로 처리) */
    socialService: number;
    /** 산학협력 영역 이수 학점 (캡스톤디자인 등 포함) */
    industry: number;
  };

  // 2. 제2전공 이수 학점 요약
  secondMajorCredits: {
    /** 제2전공 전공학점 합계 */
    majorTotal: number;
    /** 제2전공 전공핵심 이수 학점 */
    majorCore: number;
  };

  // 3. 필수 이수 조건 요약 (학점이 아닌 '횟수' 또는 '통과 여부'로 체크하는 항목)
  completedConditions: {
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
  };

  // 4. 상세 수강 내역 (과목 단위의 상세 트래킹 및 계산 검증용)
  takenCourses: Array<{
    /** 학수번호 (예: SYU1234) */
    courseCode: string;
    /** 과목명 (예: 캡스톤디자인) */
    courseName: string;
    /** 이수구분 (예: 전공핵심, 전공심화, 교양선택 등) */
    category: string;
    /** 학점 (예: 3) */
    credit: number;
    /** 영어전용강좌 여부 */
    isEnglish: boolean;
    /** IC-PBL 강좌 여부 */
    isPbl: boolean;
    /** 전공 IC-PBL 강좌 여부 */
    isMajorPbl: boolean;
  }>;
}

const AcademicRecordSchema: Schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },

  earnedCredits: {
    total: { type: Number, default: 0 },
    majorCore: { type: Number, default: 0 },
    majorAdvanced: { type: Number, default: 0 },
    majorTotal: { type: Number, default: 0 },
    generalElective: { type: Number, default: 0 },
    socialService: { type: Number, default: 0 },
    industry: { type: Number, default: 0 },
  },

  secondMajorCredits: {
    majorTotal: { type: Number, default: 0 },
    majorCore: { type: Number, default: 0 },
  },

  completedConditions: {
    englishCourses: { type: Number, default: 0 },
    pblTotal: { type: Number, default: 0 },
    pblMajor: { type: Number, default: 0 },
    hasPrerequisite: { type: Boolean, default: false },
    hasMandatoryCourse: { type: Boolean, default: false },
    hasThesis: { type: Boolean, default: false },
  },

  takenCourses: [{
    courseCode: { type: String, required: true },
    courseName: { type: String, required: true },
    category: { type: String, required: true },
    credit: { type: Number, required: true },
    isEnglish: { type: Boolean, default: false },
    isPbl: { type: Boolean, default: false },
    isMajorPbl: { type: Boolean, default: false },
  }]
}, {
  timestamps: true // 생성 및 마지막 업데이트 시간 자동 기록
});

export default mongoose.model<IAcademicRecord>('AcademicRecord', AcademicRecordSchema);
