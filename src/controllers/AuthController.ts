import { Body, Controller, Post, Route, Tags, Response, SuccessResponse } from 'tsoa';
import { AuthService, RegisterRequest, AuthResponse } from '../services/AuthService';

export interface LoginRequest {
  username?: string;
  password?: string;
}

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  private authService = AuthService.getInstance();

  /**
   * 사용자 로그인
   */
  @Post('login')
  @Response<{ error: string }>(401, "Unauthorized")
  public async login(@Body() body: LoginRequest): Promise<AuthResponse | { error: string }> {
    try {
      return await this.authService.login(body);
    } catch (error: any) {
      this.setStatus(401);
      return { error: error.message || 'Login failed' };
    }
  }

  /**
   * 사용자 회원가입
   */
  @Post('register')
  @SuccessResponse("201", "Created")
  @Response<{ error: string }>(400, "Bad Request")
  public async register(@Body() body: RegisterRequest): Promise<AuthResponse | { error: string }> {
    try {
      const result = await this.authService.register(body);
      this.setStatus(201);
      return result;
    } catch (error: any) {
      this.setStatus(400);
      return { error: error.message || 'Registration failed' };
    }
  }

  @Post('logout')
  public async logout(): Promise<{}> {
    return {};
  }
}
