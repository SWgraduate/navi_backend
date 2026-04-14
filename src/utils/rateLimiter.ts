import { Request as ExRequest } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message: string;
  /**
   * 요청 식별 방식.
   * - 'email': req.body.email 우선, 없으면 IP 사용 (이메일·로그인 등)
   * - 'ip': IP 주소만 사용 (기본값)
   */
  keyBy?: 'email' | 'ip';
}

/**
 * Rate Limiter 미들웨어 팩토리
 * AuthController 등에서 @Middlewares() 데코레이터와 함께 사용합니다.
 *
 * @example
 * const loginLimiter = createRateLimiter({ ...GLOBAL_CONFIG.rateLimits.login, keyBy: 'email' });
 */
export const createRateLimiter = ({ windowMs, max, message, keyBy = 'ip' }: RateLimiterOptions) =>
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    keyGenerator: (req: ExRequest) => {
      if (keyBy === 'email') {
        return req.body?.email || ipKeyGenerator(req as any, undefined as any);
      }
      return ipKeyGenerator(req as any, undefined as any);
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
