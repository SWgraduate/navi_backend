import { Body, Controller, Post, Route, Tags, Delete } from 'tsoa';
import mongoose from "mongoose";
import { UserModel } from '../models/User';
export interface LoginRequest {
  name?: string;
  password?: string;
}
export interface WithdrawRequest {
  userId: string;
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


@Delete("withdraw")
public async withdraw(@Body() body: WithdrawRequest): Promise<{ message: string }> {
  const { userId } = body;

  // 1) userId 유효성 검사
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    this.setStatus(400);
    return { message: "Invalid userId format" };
  }

  // 2) 삭제 시도 (핵심 수정: _id 또는 findByIdAndDelete)
  const deletedUser = await UserModel.findByIdAndDelete(userId);

  // 3) 결과 처리
  if (!deletedUser) {
    this.setStatus(404);
    return { message: "User not found (not deleted)" };
  }

  return { message: "User deleted successfully" };
}}