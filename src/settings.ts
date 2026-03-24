import dotenv from 'dotenv';
import path from 'path';

// 우선순위가 높은 외부/CLI 세팅(CROSS_ENV 등)이 없으면 기본적으로 development 로드
const envName = process.env.NODE_ENV || 'development';
const envPath = path.resolve(process.cwd(), `.env.${envName}`);
dotenv.config({ path: envPath });

if (envName !== 'production') {
  console.log(`[Config] Loaded environment variables from: .env.${envName}`);
}

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue) {
      console.log(`The environment variable '${key}' is not defined. Using default value '${defaultValue}'.`);
      return defaultValue;
    }
    throw new Error(`The environment variable '${key}' is not defined.`);
  }
  return value;
}

export const NODE_ENV = requireEnv('NODE_ENV', 'development');
export const APP_PORT = parseInt(requireEnv('APP_PORT', '8000'), 10);
export const JWT_SECRET = requireEnv('JWT_SECRET');

export const RESEND_KEY = requireEnv('RESEND_KEY');

export const MONGO_URI = requireEnv('MONGO_URI');
export const OPENROUTER_API_KEY = requireEnv('OPENROUTER_API_KEY');
export const PINECONE_API_KEY = requireEnv('PINECONE_API_KEY');

export const DISCORD_WEBHOOK_URL = requireEnv('DISCORD_WEBHOOK_URL');

export const GLOBAL_CONFIG = {
  jwtExpiresIn: '30d',

  llmBaseUrl: "https://openrouter.ai/api/v1",
  chatModel: "openai/gpt-5",
  embeddingModel: "openai/text-embedding-3-large",
  embeddingDimensions: 1024,
  visionModel: "google/gemini-3-flash-preview",

  // Vector DB
  pineconeIndexName: "rag-main",
  pineconeNamespace: "default",

  discordAlertRoleID: {
    backend: "1482976770763395207",
    ai: "1482986345507848213"
  },
};

// ─── 환경별 분기 설정 ────────────────────────────────────────────────────────
// NODE_ENV=production 일 때만 배포 환경으로 간주.
// 비밀값이 아닌 '환경 유형에서 파생되는 정책'은 여기서 코드로 정의하여 관리 부담을 줄임.

const isProd = NODE_ENV === 'production';

/**
 * Express-session 쿠키 정책.
 * - 로컬(HTTP): sameSite=lax, secure=false
 * - 배포(HTTPS): sameSite=none, secure=true  ← sameSite:none은 spec상 secure:true 필수
 */
export const COOKIE_CONFIG = {
  maxAge: 1000 * 60 * 60 * 24, // 24시간
  httpOnly: true, // XSS 방어
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
} as const;
