// Centralized configuration & environment variable validation
// Keep it small and beginner-friendly.
import dotenv from 'dotenv';
dotenv.config();

function str(name, { required = false, defaultValue = undefined, prodRequired = false, fallbackDev = undefined } = {}) {
  const v = process.env[name];
  if (v == null || v === '') {
    if (required || (prodRequired && process.env.NODE_ENV === 'production')) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Missing required env var: ${name}`);
      }
      if (fallbackDev !== undefined) {
        console.warn(`[config] ${name} missing – using insecure dev fallback`);
        return fallbackDev;
      }
    }
    return defaultValue;
  }
  return v;
}

function bool(name, def = false) {
  const v = process.env[name];
  if (!v) return def;
  return ['1','true','yes','on'].includes(v.toLowerCase());
}

function csv(name) {
  const v = process.env[name];
  if (!v) return [];
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = parseInt(process.env.PORT || '5000', 10);
export const DATABASE_URL = str('DATABASE_URL', { prodRequired: true });
export const JWT_SECRET = str('JWT_SECRET', { prodRequired: true, fallbackDev: 'dev-secret-change-me' });
export const PAYSTACK_SECRET_KEY = str('PAYSTACK_SECRET_KEY', { prodRequired: true });
export const PAYSTACK_PUBLIC_KEY = str('PAYSTACK_PUBLIC_KEY', {});
export const BACKBLAZE_KEY_ID = str('BACKBLAZE_KEY_ID', { prodRequired: true });
export const BACKBLAZE_APPLICATION_KEY = str('BACKBLAZE_APPLICATION_KEY', { prodRequired: true });
export const BACKBLAZE_BUCKET_NAME = str('BACKBLAZE_BUCKET_NAME', { prodRequired: true, defaultValue: 'tikcashprofilepictures' });
export const BACKBLAZE_REGION = str('BACKBLAZE_REGION', { prodRequired: true });
export const BACKBLAZE_ENDPOINT = str('BACKBLAZE_ENDPOINT', {});
export const BACKBLAZE_PUBLIC_BASE_URL = str('BACKBLAZE_PUBLIC_BASE_URL', {});
export const PUBLIC_APP_URL = str('PUBLIC_APP_URL', { defaultValue: 'http://localhost:3000' });
export const CORS_ORIGINS = csv('CORS_ORIGINS');
export const VERIFY_EMAIL = bool('VERIFY_EMAIL', false);
export const ENABLE_PAYSTACK_WEBHOOK = bool('ENABLE_PAYSTACK_WEBHOOK', true);

export function summarizeConfig() {
  return {
    NODE_ENV,
    PORT,
    hasDatabaseUrl: !!DATABASE_URL,
    hasJwt: !!JWT_SECRET,
    hasPaystackSecret: !!PAYSTACK_SECRET_KEY,
    corsOrigins: CORS_ORIGINS.length,
    publicAppUrl: PUBLIC_APP_URL,
  };
}
