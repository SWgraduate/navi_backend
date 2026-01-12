import { Body, Controller, Post, Route, Tags } from 'tsoa';

export interface LoginRequest {
  username?: string;
  password?: string;
}

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  @Post('login')
  public async login(@Body() body: LoginRequest): Promise<{}> {
    return {};
  }

  @Post('register')
  public async register(): Promise<{}> {
    return {};
  }

  @Post('logout')
  public async logout(): Promise<{}> {
    return {};
  }
}
