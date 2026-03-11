import mongoose, { Schema, Document } from 'mongoose';

export interface IGraduationRule extends Document {
  // 1. 기준 식별 키 (Composite Keys)
  department: string; // 학과명 (예: "컴퓨터학부")
  track: 'SINGLE' | 'MULTI_MAIN' | 'MINOR_MAIN'; // 이수 트랙 (단일전공, 다중전공시 주전공, 부전공시 주전공)
  admissionYearStart: number; // 적용 시작 학번 (예: 2024)
  admissionYearEnd: number;   // 적용 종료 학번 (예: 9999 - 현재까지 적용됨을 의미)

  // 2. 학점 요건
  credits: {
    total: number;           // 총 졸업 학점 (예: 140)
    majorCore: number;       // 전공핵심 (예: 36)
    majorAdvanced: number;   // 전공심화 (예: 24)
    majorTotal: number;      // 전공 계 (예: 75)
    generalElective: number; // 교양선택 배당 학점 (예: 10)
    socialService: number;   // 사회봉사 학점 (예: 1)
    industry: number;        // 산학협력 영역 학점 (예: 6)
  };

  // 3. 횟수 및 기타 조건 요건
  conditions: {
    englishCourses: number; // 영어전용강좌 수 (예: 2)
    pblTotal: number;       // 총 PBL 강좌 수 (예: 4)
    pblMajor: number;       // 전공 PBL 강좌 수 (예: 1)
    minGpa: number;         // 최소 졸업 평점 (예: 1.75)
    requireThesis: boolean; // 졸업논문/작품 필수 여부
  };
};

const GraduationRuleSchema: Schema = new Schema({
  department: { type: String, required: true },
  track: { type: String, required: true, enum: ['SINGLE', 'MULTI_MAIN', 'MINOR_MAIN'] },
  admissionYearStart: { type: Number, required: true },
  admissionYearEnd: { type: Number, required: true, default: 9999 },

  credits: {
    total: { type: Number, required: true },
    majorCore: { type: Number, required: true },
    majorAdvanced: { type: Number, required: true },
    majorTotal: { type: Number, required: true },
    generalElective: { type: Number, required: true },
    socialService: { type: Number, required: true },
    industry: { type: Number, required: true },
  },
  conditions: {
    englishCourses: { type: Number, required: true },
    pblTotal: { type: Number, required: true },
    pblMajor: { type: Number, required: true },
    minGpa: { type: Number, required: true, default: 1.75 },
    requireThesis: { type: Boolean, required: true },
  }
});

// 학과 + 트랙 + 학번 조합으로 빠르게 검색하기 위한 복합 인덱스
GraduationRuleSchema.index({ department: 1, track: 1, admissionYearStart: 1 });

export default mongoose.model<IGraduationRule>('GraduationRule', GraduationRuleSchema);
