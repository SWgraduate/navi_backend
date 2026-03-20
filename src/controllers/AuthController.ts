import { Body, Controller, Post, Route, Tags, Response, Security, SuccessResponse, Delete, Request } from 'tsoa';
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

  /**
   * 신규 사용자 회원가입 처리를 수행합니다.
   * 이 엔드포인트는 사전에 **6자리 인증 코드**를 통해 이메일 검증이 완료된 상태에서만 호출 가능합니다.
   * 성공적으로 가입이 완료되면 JWT 토큰을 생성하여 반환합니다.
   * @param body 회원가입에 필요한 이메일과 비밀번호
   */
  @Post('register')
  @SuccessResponse("201", "Created")
  @Response<{ error: string }>(400, "Bad Request")
  public async register(
    @Body() body: RegisterRequest,
  ): Promise<AuthResponse | { error: string }> {
    try {
      const result = await this.authService.register(body);
      this.setStatus(201);
      return result;
    } catch (error: any) {
      this.setStatus(400);
      return { error: error.message || 'Registration failed' };
    }
  }

  /**
   * 기존 사용자 로그인을 처리합니다.
   * 이메일과 비밀번호를 검증한 후, 인증에 성공하면 JWT 토큰을 생성하여 반환합니다.
   * @param body 로그인에 필요한 이메일과 비밀번호
   */
  @Post('login')
  @Response<{ error: string }>(401, "Unauthorized")
  public async login(
    @Body() body: LoginRequest,
  ): Promise<AuthResponse | { error: string }> {
    try {
      const result = await this.authService.login(body);
      return result;
    } catch (error: any) {
      this.setStatus(401);
      return { error: error.message || 'Login failed' };
    }
  }

  /**
   * 현재 로그인된 사용자를 로그아웃 처리합니다.
   * JWT 토큰을 검증한 후, 해당 토큰을 사용자 데이터베이스에서 폐기합니다.
   * @param req 토큰 정보를 포함하는 Express 요청 객체
   */
  @Post("logout")
  @Security("jwt")
  @SuccessResponse("200", "OK")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(500, "Internal Server Error")
  public async logout(@Request() req: ExRequest): Promise<{ message: string } | { error: string }> {
    try {
      const userId = req.user;

      if (!userId) {
        this.setStatus(401);
        return { error: "Unauthorized" };
      }

      await this.authService.logout(userId);
      return { message: "Successfully logged out" };
    } catch (error) {
      this.setStatus(500);
      return { error: "Logout failed" };
    }
  }

  /**
   * 현재 로그인된 사용자의 계정을 영구적으로 삭제(회원 탈퇴)합니다.
   * @param req 세션 정보를 포함하는 Express 요청 객체 (로그인된 사용자의 userId 사용)
   */
  @Delete("leave")
  @Security("jwt")
  @Response<{ error: string }>(400, "Bad Request")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(404, "Not Found")
  public async leave(
    @Request() req: ExRequest
  ): Promise<{ message: string } | { error: string }> {
    try {
      const userId = req.user;

      if (!userId) {
        this.setStatus(401);
        return { error: 'Unauthorized' };
      }

      await this.authService.leave(userId);
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

  /**
   * 회원가입 전 이메일 인증을 위한 **6자리 인증 코드**를 발송합니다.
   * 동일 이메일로 재요청 시 기존 인증 코드는 덮어쓰기(upsert)되어 새 코드가 발송됩니다.
   * @param body 인증 코드를 수신할 이메일 주소
   */
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

  /**
   * 이메일로 발송된 **6자리 인증 코드**의 유효성을 검증합니다.
   * @param body 인증할 이메일 주소와 6자리 인증 코드
   */
  @Post('email/verify')
  @SuccessResponse("200", "OK")
  @Response<{ error: string }>(400, "Bad Request")
  public async verifyEmailCode(
    @Body() body: VerifyEmailRequest
  ): Promise<{ message: string } | { error: string }> {
    try {
      await this.authService.verifyEmailCode(body.email, body.code);
      return { message: "이메일 인증이 완료되었습니다." };
    } catch (error: any) {
      this.setStatus(400);
      return { error: error.message || "인증에 실패했습니다." };
    }
  }
}