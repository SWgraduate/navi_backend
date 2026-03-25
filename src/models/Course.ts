import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICourse {
  courseCode: string;
  courseName: string;
  category: string;
  credit: number;
  department?: string;
  isEnglish: boolean;
  isPbl: boolean;
  isMajorPbl: boolean;
  classTimes?: string; // e.g. "화(09:00-11:00),목(09:00-11:00)"
}

export interface ICourseDocument extends ICourse, Document {}

const CourseSchema = new Schema<ICourseDocument>(
  {
    courseCode: { type: String, required: true, unique: true },  // 학수번호 (ex. ACC2051)
    courseName: { type: String, required: true },                // 과목명
    category: { type: String, required: true },                  // 이수구분 (ex. 전공핵심, 교양선택)
    credit: { type: Number, required: true },                    // 학점
    department: { type: String, required: false },               // 주관학과(소속) 추가 매핑
    isEnglish: { type: Boolean, default: false },                // 영어전용강좌 여부
    isPbl: { type: Boolean, default: false },                    // IC-PBL 강좌 여부
    isMajorPbl: { type: Boolean, default: false },               // 전공 IC-PBL 강좌 여부
    classTimes: { type: String, required: false },               // 수업 시간
  },
  { timestamps: true }
);

const Course: Model<ICourseDocument> = mongoose.models.Course || mongoose.model<ICourseDocument>('Course', CourseSchema);

export default Course;
