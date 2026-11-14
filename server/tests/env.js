// Loaded by Jest before any test file (see "jest.setupFiles" in package.json).
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt-signing-123';
process.env.ALLOWED_EMAIL_DOMAINS = 'edu';
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
process.env.SMTP_HOST = '';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `campusconnect-test-uploads-${process.pid}`);
