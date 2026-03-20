import 'express';

declare module 'express' {
  export interface Request {
    // authentication.ts 미들웨어가 JWT 검증 후 주입해주는 userId
    user?: string;
  }
}
