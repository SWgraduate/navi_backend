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
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 180,
  },
});

export default mongoose.model('Verification', verificationSchema);
