import * as express from "express";

export async function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[]
): Promise<any> {
  if (securityName === "sessionAuth") {
    const userId = request.session?.userId;
    
    if (!userId) {
      return Promise.reject(new Error("Unauthorized"));
    }
    
    // 인증 성공 시 userId 반환 (컨트롤러에서 @Request() req 안에서 접근 가능하게 처리됨)
    return Promise.resolve(userId);
  }
  
  return Promise.reject(new Error("Unknown security name"));
}
