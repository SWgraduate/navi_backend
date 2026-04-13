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
export const MASTER_EMAIL = requireEnv('MASTER_EMAIL', '');
export const MASTER_PASSWORD = requireEnv('MASTER_PASSWORD', '');

export const RESEND_KEY = requireEnv('RESEND_KEY');

export const MONGO_URI = requireEnv('MONGO_URI');
export const OPENROUTER_API_KEY = requireEnv('OPENROUTER_API_KEY');
export const PINECONE_API_KEY = requireEnv('PINECONE_API_KEY');

export const DISCORD_WEBHOOK_URL = requireEnv('DISCORD_WEBHOOK_URL');
export const ELEVENLABS_API_KEY = requireEnv('ELEVENLABS_API_KEY');
export const TYPECAST_API_KEY = requireEnv('TYPECAST_API_KEY');


const isProd = NODE_ENV === 'production';

export const GLOBAL_CONFIG = {
  jwtExpiresIn: '30d',

  llmBaseUrl: "https://openrouter.ai/api/v1",
  chatModel: "google/gemini-3-flash-preview",
  embeddingModel: "openai/text-embedding-3-large",
  embeddingDimensions: 1024,
  visionModel: "google/gemini-3-flash-preview",

  // Vector DB
  pineconeIndexName: "rag-main",
  pineconeCorpusNamespace: "corpus",
  pineconeUserDocsNamespace: "user-docs",

  elevenlabsVoiceId: "cgSgspJ2msm6clMCkdW9",
  typecastVoiceId: "tc_68f9c6a72f0f04a417bb136f",

  discordAlertRoleIds: {
    backend: "1482976770763395207",
    ai: "1482986345507848213"
  },

  enableFileAwareChat: !isProd, // 보안상 env에 포함할 필요 없다 판단되어 글로벌 설정 객체로 편입 (26. 3. 8. 태영)

  emailSendRateLimit: {
    windowMs: isProd ? 60 * 60 * 1000 : 5 * 60 * 1000, // prod: 1시간 | dev: 5분
    max: isProd ? 10 : 20, // prod: 10회 | dev: 20회
  },
};

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
