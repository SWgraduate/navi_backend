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

  /**
   * 신규 사용자 회원가입 처리를 수행합니다.
   * 이 엔드포인트는 사전에 **6자리 인증 코드**를 통해 이메일 검증이 완료된 상태에서만 호출 가능합니다.
   * 성공적으로 가입이 완료되면 `express-session`에 사용자 정보(ID, 이메일)를 초기화하고,
   * 보안을 위해 재사용 방지용 이메일 인증 상태 플래그를 즉시 제거합니다.
   * @param body 회원가입에 필요한 이메일과 비밀번호
   * @param req 세션 정보를 포함하는 Express 요청 객체
   */
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

  /**
   * 기존 사용자 로그인을 처리합니다.
   * 이메일과 비밀번호를 검증한 후, 인증에 성공하면 `express-session`에 사용자 정보(ID, 이메일)를 저장합니다.
   * 이후 요청에서 해당 세션 정보를 통해 로그인 여부를 판별합니다.
   * @param body 로그인에 필요한 이메일과 비밀번호
   * @param req 세션 정보를 포함하는 Express 요청 객체
   */
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

  /**
   * 현재 로그인된 사용자를 로그아웃 처리합니다.
   * 서버에 저장된 세션 데이터를 파기하고, 클라이언트 브라우저의 세션 쿠키(`connect.sid`)를 삭제합니다.
   * 로그인 상태가 아닌 경우 401 Unauthorized를 반환합니다.
   * @param req 세션 정보를 포함하는 Express 요청 객체
   */
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

  /**
   * 현재 로그인된 사용자의 계정을 영구적으로 삭제(회원 탈퇴)합니다.
   * 세션에서 이메일 정보를 확인하여 본인 여부를 검증한 후, 데이터베이스에서 사용자 정보를 삭제합니다.
   * 탈퇴 완료 후에는 세션 데이터를 파기하고 세션 쿠키도 삭제합니다.
   * @param req 세션 정보를 포함하는 Express 요청 객체 (로그인된 사용자의 이메일 사용)
   */
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

  /**
   * 회원가입 전 이메일 인증을 위한 **6자리 인증 코드**를 발송합니다.
   * 동일 이메일로 재요청 시 기존 인증 코드는 덮어쓰기(upsert)되어 새 코드가 발송됩니다.
   * 인증 코드는 이후 `/auth/email/verify` 엔드포인트를 통해 검증해야 합니다.
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
   * 인증에 성공하면 현재 세션에 이메일 인증 완료 상태(`isEmailVerified: true`)를 기록합니다.
   * 이 세션 플래그는 `/auth/register` 엔드포인트에서 회원가입 허용 여부를 판단하는 데 사용됩니다.
   * 인증에 사용된 코드는 재사용을 방지하기 위해 즉시 데이터베이스에서 삭제됩니다.
   * @param body 인증할 이메일 주소와 6자리 인증 코드
   * @param req 세션 정보를 포함하는 Express 요청 객체
   */
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