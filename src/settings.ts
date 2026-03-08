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

export const APP_PORT = requireEnv('PORT', '3000');
export const SESSION_SECRET = requireEnv('SESSION_SECRET');

export const EMAIL_USER = requireEnv('EMAIL_USER');
export const EMAIL_PASS = requireEnv('EMAIL_PASS');

export const MONGO_URI = requireEnv('MONGO_URI');
export const LLM_TOKEN = requireEnv('LLM_TOKEN');
