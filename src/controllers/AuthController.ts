import { Body, Controller, Post, Route, Tags,Delete } from 'tsoa';
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

  @Delete('withdraw')

public async withdraw(@Body() body: WithdrawRequest) {
  const oneUser = await UserModel.findOne();
  console.log("sample user in DB:", oneUser?._id?.toString(), oneUser?.username);

  const { userId } = body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    this.setStatus(400);
    return { message: "Invalid userId format" };
  }

  const deletedUser = await UserModel.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(userId),
  });

  if (!deletedUser) {
    this.setStatus(404);
    return { message: "User not found (not deleted)" };
  }

  return { message: "User deleted successfully" };
}
}