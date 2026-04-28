import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export const SECOND_MAJOR = {
  MULTI: '다중전공',
  CONVERGENCE: '융합전공',
  MINOR: '부전공',
  DOUBLE: '복수전공',
  LINKED: '연계전공',
  MICRO: '마이크로전공',
} as const;

export const SECOND_MAJOR_TYPES = Object.values(SECOND_MAJOR);
export type SecondMajorType = typeof SECOND_MAJOR[keyof typeof SECOND_MAJOR];

export const ACADEMIC_STATUSES = ['재학생', '휴학생'] as const;
export type AcademicStatus = typeof ACADEMIC_STATUSES[number];

export interface ISecondMajorInfo {
  type: SecondMajorType;
  name: string;
}

export interface IStudent extends Document {
  userId: mongoose.Types.ObjectId | IUser;
  admissionYear: number;
  studentNumber: string;
  name: string;
  major: string;
  secondMajorInfo?: ISecondMajorInfo | null;
  academicStatus: AcademicStatus;
  completedSemesters: number;
  isTransfer?: boolean; // 편입생 여부 (예외 케이스 대응)
}

const SecondMajorSchema = new Schema(
  {
    type: {
      type: String,
      enum: SECOND_MAJOR_TYPES,
      required: true,
    },
    name: { type: String, required: true },
  },
  { _id: false }
);

const StudentSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    admissionYear: { type: Number, required: true },
    studentNumber: { type: String, required: true },
    name: { type: String, required: true },
    major: { type: String, required: true },
    secondMajorInfo: {
      type: SecondMajorSchema,
      default: null,
    },
    academicStatus: {
      type: String,
      enum: ACADEMIC_STATUSES,
      required: true,
    },
    completedSemesters: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    isTransfer: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IStudent>('Student', StudentSchema);
