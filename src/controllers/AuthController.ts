import { Body, Controller, Post, Route, Tags, Response, SuccessResponse, Delete, Request } from 'tsoa';
import { Request as ExRequest } from 'express';
import { AuthService, RegisterRequest, AuthResponse } from 'src/services/AuthService';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SendEmailRequest {
  email: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
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

      // 가입 완료 후: 재사용 방지용 인증 제거
      req.session.isEmailVerified = undefined;

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

  @Post('email/send')
  @SuccessResponse("200", "OK")
  @Response<{ error: string }>(500, "Internal Server Error")
  public async sendEmailVerification(
    @Body() body: SendEmailRequest
  ): Promise<{ message: string } | { error: string }> {
    try {
      await this.authService.requestEmailVerification(body.email);
      return { message: "인증 메일이 성공적으로 발송되었습니다." };
    } catch (error: any) {
      this.setStatus(500);
      return { error: error.message || "메일 발송에 실패했습니다." };
    }
  }

  @Post('email/verify')
  @SuccessResponse("200", "OK")
  @Response<{ error: string }>(400, "Bad Request")
  public async verifyEmailCode(
    @Body() body: VerifyEmailRequest,
    @Request() req: ExRequest
  ): Promise<{ message: string } | { error: string }> {
    try {
      // 서비스에서 에러를 던지지 않고 넘어오면 인증 성공!
      await this.authService.verifyEmailCode(body.email, body.code);

      // 💡 핵심: 현재 세션에 '이메일 인증 완료' 도장을 쾅 찍습니다.
      req.session.isEmailVerified = true;

      return { message: "이메일 인증이 완료되었습니다." };
    } catch (error: any) {
      this.setStatus(400);
      return { error: error.message || "인증에 실패했습니다." };
    }
  }
}