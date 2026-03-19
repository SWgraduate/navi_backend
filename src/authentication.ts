import * as express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./settings";
import User from "./models/User";

class AuthenticationError extends Error {
  public status: number;

  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthenticationError";
    this.status = status;
  }
}

// JWT를 생성할 때 넣을 데이터 구조
interface TokenPayload extends jwt.JwtPayload {
  userId: string;
}

export async function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[]
): Promise<any> {
  if (securityName === "jwt") {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Promise.reject(new AuthenticationError("No token provided", 401));
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return Promise.reject(new AuthenticationError("Invalid token format", 401));
    }

    try {
      // JWT 서명 및 만료일 검증
      const decoded = jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;

      // DB에서 유저 조회 및 해당 토큰이 활성화 상태인지(activeTokens에 있는지) 검사
      const user = await User.findOne({
        _id: decoded.userId,
        activeTokens: token
      });

      if (!user) {
        return Promise.reject(new AuthenticationError("Token is invalidated or user not found", 401));
      }

      // 인증 성공, 컨트롤러에서 사용할 userId 반환
      return Promise.resolve(decoded.userId);

    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return Promise.reject(new AuthenticationError("Token expired", 401));
      }
      return Promise.reject(new AuthenticationError("Invalid token", 401));
    }
  }

  return Promise.reject(new AuthenticationError("Unknown security name", 401));
}
