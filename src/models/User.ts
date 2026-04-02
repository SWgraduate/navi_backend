import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export const USER_ROLES = ['student', 'staff', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export interface IUser extends Document {
  email: string;
  password?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  activeToken: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: USER_ROLES[0] },
    activeToken: { type: String, default: null },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
  }
);

// 저장 전 비밀번호 해싱
UserSchema.pre('save', async function () {
  const user = this as unknown as IUser;
  if (!user.isModified('password') || !user.password) return;

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

// 비밀번호 비교 메서드
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
