const jwt = require('jsonwebtoken');
const config = require('../config/env');

const signToken = (userId) =>
  jwt.sign({ id: String(userId) }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const verifyToken = (token) => jwt.verify(token, config.jwt.secret);

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd || config.jwt.cookieSameSite === 'none',
  sameSite: config.jwt.cookieSameSite,
  maxAge: config.jwt.cookieMaxAgeMs,
  path: '/',
});

/** Issues a JWT, stores it in an httpOnly cookie and returns it (for API clients). */
function setAuthCookie(res, userId) {
  const token = signToken(userId);
  res.cookie(config.jwt.cookieName, token, cookieOptions());
  return token;
}

function clearAuthCookie(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(config.jwt.cookieName, opts);
}

/** Extracts a token from "Authorization: Bearer" or the auth cookie. */
function extractToken({ headers = {}, cookies = {} }) {
  const auth = headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return cookies[config.jwt.cookieName] || null;
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, extractToken };
