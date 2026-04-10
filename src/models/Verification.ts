import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true, // 한 이메일당 하나의 인증번호만 유지
  },
  code: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  resetToken: {
    type: String,
    default: null, // 비밀번호 재설정 인증 완료 후 발급되는 임시 토큰
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // 5분 TTL (비밀번호 재설정 flow 고려하여 180 → 300으로 상향)
  },
});

export default mongoose.model('Verification', verificationSchema);
