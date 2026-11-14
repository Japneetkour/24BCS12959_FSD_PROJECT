const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const skip = () => config.isTest;
const message = (msg) => ({ success: false, message: msg });

/** General API limiter: 600 requests / 15 min per IP. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: message('Too many requests. Please slow down and try again shortly.'),
});

/** Brute-force protection for login / register / password reset: 20 / 15 min. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  skipSuccessfulRequests: true,
  message: message('Too many attempts. Please wait 15 minutes and try again.'),
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: message('Upload limit reached. Try again in an hour.'),
});

module.exports = { apiLimiter, authLimiter, uploadLimiter };
