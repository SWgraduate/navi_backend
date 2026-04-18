import crypto from 'crypto';
import { formatInTimeZone } from 'date-fns-tz';
import jwt from 'jsonwebtoken';
import { LoginRequest } from 'src/controllers/AuthController';
import User from 'src/models/User';
import Verification from 'src/models/Verification';
import { GLOBAL_CONFIG, JWT_SECRET } from 'src/settings';
import { discordAlert, logger } from 'src/utils/log';
import { listSentEmails, sendVerificationEmail } from 'src/utils/mailer';

export interface RegisterRequest {
  /**
   * 가입할 사용자의 이메일 주소
   * @example "newuser@example.com"
   */
  email: string;
  /**
   * 사용할 비밀번호 (영어, 숫자, 특수문자 포함 8자 이상)
   * @minLength 8
   * @pattern ^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+])[A-Za-z\d!@#$%^&*()_+]{8,}$
   * @example "securePassword123!"
   */
  password: string;
}

export interface AuthResponse {
  /**
   * 사용자 기본 정보
   */
  user: {
    /** 사용자 고유 ID (MongoDB ObjectId) */
    id: string;
    /** 사용자 이메일 */
    email: string;
    /** 사용자 역할 (예: user, admin) */
    role: string;
  };
  /**
   * 인증 시 사용되는 JWT 액세스 토큰
   */
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

  private validateEmailDomain(email: string): void {
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email format');
    }
    const domain = email.split('@')[1];
    if (!domain || !GLOBAL_CONFIG.allowedEmailDomains.includes(domain)) {
      throw new Error("허용된 이메일 도메인(" + GLOBAL_CONFIG.allowedEmailDomains.join(', ') + ")만 사용할 수 있습니다.");
    }
  }

  public async register(data: RegisterRequest): Promise<AuthResponse> {
    const { email, password } = data;

    this.validateEmailDomain(email);

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
    this.validateEmailDomain(email);

    // 6자리 난수 생성 (예: 048291)
    const code = crypto.randomInt(100000, 1000000).toString().padStart(6, '0');

    // 기존에 요청한 인증번호가 있다면 덮어쓰기 (upsert)
    await Verification.findOneAndUpdate(
      { email },
      { code, createdAt: new Date(), isVerified: false },
      { upsert: true, returnDocument: 'after' }
    );

    // 메일 발송 유틸리티 호출
    await sendVerificationEmail(email, code, 'registration');
    this.reportResendUsageToDiscord().catch(e => logger.e('Discord monitoring alert failed (Registration):', e));
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
   * [비밀번호 재설정 - 1단계] 등록된 이메일로 인증 코드 발송.
   * 
   * 보안 정책: 존재하지 않는 이메일이 입력되어도 사용자에게 에러를 반환하지 않고 
   * 조용히 성공 처리하여 계정의 존재 여부를 노출하지 않습니다 (Early Return).
   * 
   * @param email 코드 발송 대상 이메일
   */
  public async forgotPassword(email: string): Promise<void> {
    this.validateEmailDomain(email);
    const user = await User.findOne({ email });
    if (!user) {
      // 계정 존재 여부 노출 방지: 실제로는 아무 동작도 하지 않고 조용히 종료
      return;
    }

    const code = crypto.randomInt(100000, 1000000).toString().padStart(6, '0');

    await Verification.findOneAndUpdate(
      { email },
      { code, createdAt: new Date(), isVerified: false, resetToken: null },
      { upsert: true, returnDocument: 'after' }
    );

    await sendVerificationEmail(email, code, 'password_reset');
    this.reportResendUsageToDiscord().catch(e => logger.e('Discord monitoring alert failed (Password Reset):', e));
  }

  /**
   * [비밀번호 재설정 - 2단계] 인증 코드 검증 후 비밀번호 재설정용 임시 토큰 발급.
   * 
   * 발급된 `resetToken`은 3단계(resetPassword) API 호출 시 본인 인증 수단으로 사용됩니다.
   * Verification 모델의 TTL(5분)에 따라 만료 시 자동 삭제됩니다.
   * 
   * @param email 검증 대상 이메일
   * @param code 사용자로부터 입력받은 6자리 인증 코드
   * @returns 발급된 64자 길이의 임시 resetToken
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

    record.resetToken = resetToken;
    await record.save();

    return resetToken;
  }

  /**
   * [비밀번호 재설정 - 3단계] resetToken 검증 후 새 비밀번호로 갱신.
   * 
   * User 모델의 save() 메서드를 직접 호출하여 스키마에 정의된 pre-save 해싱 훅이 
   * 정상적으로 작동하도록 합니다. 성공 시 해당 이메일의 모든 Verification 레코드를 삭제합니다.
   * 
   * @param email 초기화 대상 이메일
   * @param resetToken 2단계에서 발급받은 임시 토큰
   * @param newPassword 새로 설정할 비밀번호 (평문전달 시 모델에서 해싱됨)
   */
  public async resetPassword(email: string, resetToken: string, newPassword: string): Promise<void> {
    const record = await Verification.findOne({ email, resetToken });

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

  /**
   * Resend API 이메일 발송 사용량을 디스코드로 알림
   */
  private async reportResendUsageToDiscord(): Promise<void> {
    try {
      const now = new Date();
      const tz = 'Asia/Seoul';

      // KST(한국 시간) 기준으로 YYYY-MM-DD 추출
      const todayStr = formatInTimeZone(now, tz, 'yyyy-MM-dd');
      const monthStr = todayStr.substring(0, 7); // YYYY-MM

      let monthCount = 0;
      let todayCount = 0;

      let hasMore = true;
      let after: string | undefined = undefined;
      let pagesFetched = 0;
      const MAX_PAGES = 10; // 최대 10페이지 (1000건)

      while (hasMore && pagesFetched < MAX_PAGES) {
        pagesFetched++;
        const response = await listSentEmails({ limit: 100, after });

        if (!response || !response.data || response.data.length === 0) break;

        for (const email of response.data) {
          if (!email.created_at) continue;

          const emailDateStr = formatInTimeZone(new Date(email.created_at), tz, 'yyyy-MM-dd');
          const emailMonthStr = emailDateStr.substring(0, 7);

          if (emailMonthStr === monthStr) {
            monthCount++;
            if (emailDateStr === todayStr) {
              todayCount++;
            }
          } else {
            hasMore = false;
            break;
          }
        }

        if (hasMore && response.data.length > 0) {
          after = response.data[response.data.length - 1]?.id;
        } else {
          hasMore = false;
        }
      }

      const currentMonthName = formatInTimeZone(now, tz, 'MMM');
      const currentDay = formatInTimeZone(now, tz, 'd');

      const limitWarning = pagesFetched >= MAX_PAGES ? '+' : '';
      const message = `Resend Email Usage - ${currentMonthName} ${currentDay}: ${todayCount}, ${currentMonthName}: ${monthCount}${limitWarning}`;
      await discordAlert(message);
    } catch (e) {
      logger.e('Failed to aggregate Resend usage:', e);
    }
  }
}
