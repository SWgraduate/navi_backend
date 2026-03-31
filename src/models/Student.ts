import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export type SecondMajorType = '다중전공' | '융합전공' | '부전공' | '복수전공' | '연계전공' | '마이크로전공';
export type AcademicStatus = '재학생' | '휴학생';

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
}

const SecondMajorSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['다중전공', '융합전공', '부전공', '복수전공', '연계전공', '마이크로전공'],
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
