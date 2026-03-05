import User from 'src/models/User';
import { LoginRequest } from 'src/controllers/AuthController';

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

  public async login(data: LoginRequest): Promise<AuthResponse> {
    const { email, password } = data;

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

  public async leave(email: string): Promise<void> {
    const deletedUser = await User.findOneAndDelete({ email });
    if (!deletedUser) {
      throw new Error('User not found');
    }
  }
}
