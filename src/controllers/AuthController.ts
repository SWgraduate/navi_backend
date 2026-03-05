import { Body, Controller, Post, Route, Tags, Response, SuccessResponse, Delete } from 'tsoa';
import { AuthService, RegisterRequest, AuthResponse } from 'src/services/AuthService';

export interface LoginRequest {
  email?: string;
  password?: string;
}

export interface LeaveRequest {
  email: string;
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

  // TODO: 서비스 인스턴스 활용하여 구현 필요 (26. 2. 24. 태영) -> *해결됨*
  /**
   * 사용자 회원탈퇴
   */
  @Delete("leave")
  @Response<{ error: string }>(400, "Bad Request")
  @Response<{ error: string }>(404, "Not Found")
  public async leave(@Body() body: LeaveRequest): Promise<{ message: string } | { error: string }> {
    const { email } = body;

    try {
      await this.authService.leave(email);
      return { message: "User successfully left" };
    } catch (error: any) {
      if (error.message === 'User not found') {
        this.setStatus(404);
        return { error: error.message };
      }
      this.setStatus(400);
      return { error: 'Leave failed' };
    }
  }
}