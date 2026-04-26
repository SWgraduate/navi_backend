import mongoose, { Document, Schema } from 'mongoose';

/**
 * Major 컬렉션 도큐먼트 인터페이스.
 * 
 * 단과대학(college) 아래 전공/학과(name) 하나를 표현합니다.
 * importMajors.ts 스크립트가 이 스키마에 맞춰 데이터를 시딩합니다.
 */
export interface IMajor extends Document {
  /** 소속 단과대학 이름 (예: 공과대학, 소프트웨어융합대학) */
  college: string;
  /** 전공 / 학과 / 학부명 (예: 컴퓨터소프트웨어학부, 건축학전공) */
  name: string;
}

const MajorSchema: Schema = new Schema(
  {
    college: { type: String, required: true, index: true },
    name: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
    collection: 'majors',
  }
);

// 대학 + 전공명 복합 인덱스 (조회 최적화)
MajorSchema.index({ college: 1, name: 1 });

export default mongoose.model<IMajor>('Major', MajorSchema);
