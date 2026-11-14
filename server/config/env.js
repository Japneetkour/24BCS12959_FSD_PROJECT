const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const list = (value) =>
  (value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProd) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
  }
  jwtSecret = jwtSecret || 'dev-only-insecure-secret-change-me-0123456789abcdef';
  if (env !== 'test') {
    console.warn('[config] JWT_SECRET missing or short — using an insecure development secret.');
  }
}

if (isProd && (!process.env.MONGO_URI || process.env.MONGO_URI === 'memory')) {
  throw new Error('MONGO_URI must point to a real MongoDB database in production (e.g. MongoDB Atlas).');
}

const config = {
  env,
  isProd,
  isTest: env === 'test',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || 'memory',
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    cookieName: 'cc_token',
    cookieMaxAgeMs: (parseInt(process.env.JWT_COOKIE_DAYS, 10) || 7) * 24 * 60 * 60 * 1000,
    // "lax" works for same-origin deployments; use "none" (+ HTTPS) if client and API live on different sites.
    cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins: list(process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173'),
  allowedEmailDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION !== 'false',
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'CampusConnect <no-reply@campusconnect.app>',
  },
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 15,
  serveClient: process.env.SERVE_CLIENT === 'true',
  seedOnMemory: process.env.SEED_ON_MEMORY !== 'false',
};

module.exports = config;
