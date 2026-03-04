import User from '@/models/User';
import { LoginRequest } from '@/controllers/AuthController';

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
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

  /**
   * 사용자 등록 (회원가입)
   */
  public async register(data: RegisterRequest): Promise<AuthResponse> {
    const { email, password, name } = data;

    // 1. 이메일 중복 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // 2. 사용자 생성 (비밀번호는 모델의 pre-save 훅에서 자동 암호화됨)
    const newUser = new User({
      email,
      password,
      name,
    });

    await newUser.save();

    return {
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    };
  }

  /**
   * 사용자 로그인
   */
  public async login(data: LoginRequest): Promise<AuthResponse> {
    const { username: email, password } = data; // username 필드를 email로 사용

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // 1. 사용자 조회
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // 2. 비밀번호 확인
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * 사용자 회원 탈퇴(삭제)
   */
  public async withdraw(userId: string): Promise<void> {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      throw new Error('User not found');
    }
  }
}
