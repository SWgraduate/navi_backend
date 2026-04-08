import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, GLOBAL_CONFIG } from 'src/settings';
import { LoginRequest } from 'src/controllers/AuthController';
import User from 'src/models/User';
import Verification from 'src/models/Verification';
import { sendVerificationEmail } from 'src/utils/mailer';

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() { }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: GLOBAL_CONFIG.jwtExpiresIn as any });
  }

  public async register(data: RegisterRequest): Promise<AuthResponse> {
    const { email, password } = data;

    // 이메일 중복 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // 이메일 인증 여부 확인
    const verifiedRecord = await Verification.findOne({ email, isVerified: true });
    if (!verifiedRecord) {
      throw new Error('Email not verified');
    }

    // 사용자 생성 (비밀번호는 모델의 pre-save 훅에서 자동 암호화됨)
    const newUser = new User({ email, password });
    const token = this.generateToken(newUser._id.toString());

    newUser.activeToken = token;
    await newUser.save();

    await Verification.deleteOne({ email }); // 인증 기록 삭제 (재사용 방지)

    return {
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        role: newUser.role,
      },
      accessToken: token,
    };
  }

  public async login(data: LoginRequest): Promise<AuthResponse> {
    const { email, password } = data;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // 사용자 조회
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // 비밀번호 확인
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user._id.toString());
    user.activeToken = token;
    await user.save();

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      accessToken: token,
    };
  }

  public async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { $set: { activeToken: null } });
  }

  public async leave(userId: string): Promise<void> {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      throw new Error('User not found');
    }
  }

  public async requestEmailVerification(email: string): Promise<void> {
    // 6자리 난수 생성 (예: 048291)
    const code = crypto.randomInt(100000, 999999).toString().padStart(6, '0');

    // 기존에 요청한 인증번호가 있다면 덮어쓰기 (upsert)
    await Verification.findOneAndUpdate(
      { email },
      { code, createdAt: new Date(), isVerified: false },
      { upsert: true, returnDocument: 'after' }
    );

    // 메일 발송 유틸리티 호출
    await sendVerificationEmail(email, code, 'registration');
  }

  public async verifyEmailCode(email: string, code: string): Promise<boolean> {
    const record = await Verification.findOne({ email });

    if (!record) {
      throw new Error('인증번호가 만료되었거나 존재하지 않습니다.');
    }

    if (record.code !== code) {
      throw new Error('인증번호가 일치하지 않습니다.');
    }

    record.isVerified = true;
    await record.save();
    return true;
  }

  /**
   * 비밀번호 재설정 1단계: 등록된 이메일로 인증 코드 발송.
   * 보안상 존재하지 않는 이메일도 성공 응답으로 처리하여 계정 존재 여부를 노출하지 않음.
   */
  public async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      // 계정 존재 여부 노출 방지: 실제로는 아무 동작도 하지 않고 조용히 종료
      return;
    }

    const code = crypto.randomInt(100000, 999999).toString().padStart(6, '0');

    await Verification.findOneAndUpdate(
      { email },
      { code, createdAt: new Date(), isVerified: false, resetToken: null },
      { upsert: true, returnDocument: 'after' }
    );

    await sendVerificationEmail(email, code, 'password_reset');
  }

  /**
   * 비밀번호 재설정 2단계: 인증 코드 검증 후 비밀번호 재설정용 임시 토큰 발급.
   * 발급된 resetToken은 3단계 API 호출 시 사용되며, TTL 만료와 함께 자동 삭제됨.
   */
  public async verifyPasswordResetCode(email: string, code: string): Promise<string> {
    const record = await Verification.findOne({ email });

    if (!record) {
      throw new Error('인증번호가 만료되었거나 존재하지 않습니다.');
    }

    if (record.code !== code) {
      throw new Error('인증번호가 일치하지 않습니다.');
    }

    // 임시 토큰 생성 (32바이트 hex = 64자)
    const resetToken = crypto.randomBytes(32).toString('hex');

    record.isVerified = true;
    record.resetToken = resetToken;
    await record.save();

    return resetToken;
  }

  /**
   * 비밀번호 재설정 3단계: resetToken 검증 후 새 비밀번호로 갱신.
   * user.save() 호출로 기존 pre-save 해싱 hook을 통해 안전하게 저장됨.
   */
  public async resetPassword(email: string, resetToken: string, newPassword: string): Promise<void> {
    const record = await Verification.findOne({ email, isVerified: true, resetToken });

    if (!record) {
      throw new Error('유효하지 않거나 만료된 재설정 토큰입니다.');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    user.password = newPassword;
    await user.save(); // pre-save hook에서 자동 해싱

    await Verification.deleteOne({ email }); // 재사용 방지
  }
}
