import dotenv from 'dotenv';

dotenv.config();

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

export const APP_PORT = parseInt(requireEnv('APP_PORT', '8000'), 10);
export const SESSION_SECRET = requireEnv('SESSION_SECRET');

export const RESEND_KEY = requireEnv('RESEND_KEY');

export const MONGO_URI = requireEnv('MONGO_URI');
export const OPENROUTER_API_KEY = requireEnv('OPENROUTER_API_KEY');
export const PINECONE_API_KEY = requireEnv('PINECONE_API_KEY');

export const DISCORD_WEBHOOK_URL = requireEnv('DISCORD_WEBHOOK_URL');
export const DISCORD_ALERT_ROLE_ID = process.env.DISCORD_ALERT_ROLE_ID || null;
export const GLOBAL_CONFIG = {
  llmBaseUrl: "https://openrouter.ai/api/v1",
  chatModel: "openai/gpt-5",
  embeddingModel: "openai/text-embedding-3-large",
  embeddingDimensions: 1024,
  visionModel: "google/gemini-3-flash-preview",

  // Vector DB
  pineconeIndexName: "rag-main",
  pineconeNamespace: "default",
};
