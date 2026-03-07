import { Body, Controller, Post, Route, Tags, Response, SuccessResponse, Delete, Request } from 'tsoa';
import { Request as ExRequest } from 'express';
import { AuthService, RegisterRequest, AuthResponse } from 'src/services/AuthService';

export interface LoginRequest {
  email?: string;
  password?: string;
}

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  private authService = AuthService.getInstance();

  @Post('register')
  @SuccessResponse("201", "Created")
  @Response<{ error: string }>(400, "Bad Request")
  public async register(
    @Body() body: RegisterRequest,
    @Request() req: ExRequest
  ): Promise<AuthResponse | { error: string }> {
    try {
      const result = await this.authService.register(body);
      req.session.userEmail = result.user.email;
      req.session.userId = result.user.id;
      req.session.role = result.user.role;
      this.setStatus(201);
      return result;
    } catch (error: any) {
      this.setStatus(400);
      return { error: error.message || 'Registration failed' };
    }
  }

  @Post('login')
  @Response<{ error: string }>(401, "Unauthorized")
  public async login(
    @Body() body: LoginRequest,
    @Request() req: ExRequest
  ): Promise<AuthResponse | { error: string }> {
    try {
      const result = await this.authService.login(body);
      req.session.userEmail = result.user.email;
      req.session.userId = result.user.id;
      req.session.role = result.user.role;
      return result;
    } catch (error: any) {
      this.setStatus(401);
      return { error: error.message || 'Login failed' };
    }
  }

  @Post("logout")
  @SuccessResponse("200", "OK")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(500, "Internal Server Error")
  public async logout(@Request() req: ExRequest): Promise<{ message: string } | { error: string }> {
    // 로그인된 세션인지
    if (!req.session.userEmail) {
      this.setStatus(401);
      return { error: "로그인 상태가 아닙니다." };
    }

    return new Promise((resolve, reject) => {
      // 서버에 저장된 유저 세션 데이터 파기
      req.session.destroy((err) => {
        if (err) {
          this.setStatus(500);
          return reject(new Error("Logout failed"));
        }

        // 클라이언트에 남은 방문증(쿠키) 삭제
        if (req.res) {
          req.res.clearCookie('connect.sid');
        }

        resolve({ message: "Successfully logged out" });
      });
    });
  }

  @Delete("leave")
  @Response<{ error: string }>(400, "Bad Request")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(404, "Not Found")
  public async leave(
    @Request() req: ExRequest
  ): Promise<{ message: string } | { error: string }> {
    const email = req.session.userEmail;

    if (!email) {
      this.setStatus(401);
      return { error: 'Unauthorized' };
    }

    try {
      await this.authService.leave(email);
      return new Promise((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) {
            this.setStatus(500);
            return reject(new Error("세션 파기에 실패했습니다."));
          }
          if (req.res) {
            req.res.clearCookie('connect.sid');
          }
          resolve({ message: "User successfully left" });
        });
      });
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