const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');
const { verifyToken, extractToken } = require('../utils/token');

/** Resolves a JWT into an active user, or throws an ApiError. Shared by HTTP and Socket.io. */
async function getUserFromToken(token) {
  if (!token) throw ApiError.unauthorized();
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }
  const user = await User.findById(decoded.id);
  if (!user) throw ApiError.unauthorized('The account for this session no longer exists.');
  if (!user.isActive) throw ApiError.forbidden('Your account has been suspended. Contact the administrator.');
  if (user.changedPasswordAfter(decoded.iat)) {
    throw ApiError.unauthorized('Password was changed recently. Please log in again.');
  }
  return user;
}

const protect = asyncHandler(async (req, _res, next) => {
  req.user = await getUserFromToken(extractToken(req));
  next();
});

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(ApiError.forbidden());
  return next();
};

module.exports = { protect, authorize, getUserFromToken };
