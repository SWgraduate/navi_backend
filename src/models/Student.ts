import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export type SecondMajorType = '다중전공' | '융합전공' | '부전공' | '복수전공' | '연계전공' | '마이크로전공' | '선택';
export type AcademicStatus = '재학생' | '휴학생';

export interface IStudent extends Document {
  userId: mongoose.Types.ObjectId | IUser;
  admissionYear: number;
  name: string;
  major: string;
  secondMajorType: SecondMajorType;
  secondMajor?: string;
  academicStatus: AcademicStatus;
  completedSemesters: number;
}

const StudentSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    admissionYear: { type: Number, required: true },
    name: { type: String, required: true },
    major: { type: String, required: true },
    secondMajorType: {
      type: String,
      enum: ['다중전공', '융합전공', '부전공', '복수전공', '연계전공', '마이크로전공', '선택'],
      required: true,
    },
    secondMajor: { type: String },
    academicStatus: {
      type: String,
      enum: ['재학생', '휴학생'],
      required: true,
    },
    completedSemesters: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IStudent>('Student', StudentSchema);
