import { Body, Controller, Post, Route, Tags, Response, SuccessResponse } from 'tsoa';
import { AuthService, RegisterRequest, AuthResponse } from '../services/AuthService';

export interface LoginRequest {
  username?: string;
  password?: string;
}

export interface WithdrawRequest {
  userId: string;
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

  // TODO: 서비스 인스턴스 활용하여 구현 필요 (26. 2. 24. 태영)
  /**
   * 사용자 회원탈퇴
   */
  @Delete("withdraw")
  public async withdraw(@Body() body: WithdrawRequest): Promise<{ message: string }> {
    const { userId } = body;

    //서버가 실제로 연결된 DB 이름
    // console.log("Connected DB:", mongoose.connection.name);

    //UserModel이 바라보는 컬렉션 이름
    // console.log("User collection:", UserModel.collection.name);

    //전달받은 userId
    console.log("Received userId:", userId);

    // 1) userId 유효성 검사
    // if (!mongoose.Types.ObjectId.isValid(userId)) {
    //   this.setStatus(400);
    //   return { message: "Invalid userId format" };
    // }

    // 2) 삭제 시도 (핵심 수정: _id 또는 findByIdAndDelete)
    // const deletedUser = await UserModel.findByIdAndDelete(userId);

    // 3) 결과 처리
    // if (!deletedUser) {
    //   this.setStatus(404);
    //   return { message: "User not found (not deleted)" };
    // }

    return { message: "This wasn't implemented yet" };
  }
}