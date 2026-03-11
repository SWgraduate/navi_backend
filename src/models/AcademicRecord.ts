// src/models/AcademicRecord.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IAcademicRecord extends Document {
  studentId: mongoose.Types.ObjectId; // 어떤 학생의 기록인지 (Student 컬렉션 참조)

  // 1. 이수 학점 요약 (GraduationRule과 비교하기 위한 누적 학점 데이터)
  earnedCredits: {
    total: number;           // 모든 이수학점의 총합 (졸업학점)
    majorCore: number;       // 전공핵심 이수 학점
    majorAdvanced: number;   // 전공심화 이수 학점
    majorTotal: number;      // 전공 계 (핵심 + 심화 + 기타 전공 학점 총합)
    generalElective: number; // 교양선택 이수 학점
    socialService: number;   // 사회봉사 이수 학점
    industry: number;        // 산학협력 영역 이수 학점 (캡스톤디자인 등 포함)
  };

  // 2. 이수 조건 요약 (학점이 아닌 '횟수'나 '통과 여부'로 체크하는 항목들)
  completedConditions: {
    englishCourses: number;  // 영어전용강좌 이수 개수
    pblTotal: number;        // IC-PBL 강좌 전체 이수 개수
    pblMajor: number;        // 전공 IC-PBL 강좌 이수 개수
  };

  // 3. 상세 수강 내역 (선택 사항: 과목 단위의 상세 트래킹 및 계산 검증용)
  takenCourses: Array<{
    courseCode: string;  // 학수번호 (예: SYU1234)
    courseName: string;  // 과목명 (예: 캡스톤디자인)
    category: string;    // 이수구분 (예: 전공핵심, 전공심화, 교양선택 등)
    credit: number;      // 학점 (예: 3)
    isEnglish: boolean;  // 영어전용강좌 여부 (계산용 플래그)
    isPbl: boolean;      // PBL 강좌 여부 (계산용 플래그)
    isMajorPbl: boolean; // 전공 PBL 여부 (계산용 플래그)
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

  completedConditions: {
    englishCourses: { type: Number, default: 0 },
    pblTotal: { type: Number, default: 0 },
    pblMajor: { type: Number, default: 0 },
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
