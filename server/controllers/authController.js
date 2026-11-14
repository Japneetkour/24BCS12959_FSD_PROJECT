const config = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, sendSuccess } = require('../utils/helpers');
const { setAuthCookie, clearAuthCookie } = require('../utils/token');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { logActivity } = require('../services/activityService');

/** University email check: "edu" allows mit.edu, "ac.in" allows abc.ac.in. Empty list = any domain. */
function isAllowedDomain(email) {
  if (!config.allowedEmailDomains.length) return true;
  const domain = email.split('@')[1] || '';
  return config.allowedEmailDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** In development without SMTP we return the link so the flow can be completed from the UI. */
const devLink = (result, url) => (!result.delivered && !config.isProd ? { devLink: url } : {});

const issueSession = (res, user) => {
  const token = setAuthCookie(res, user._id);
  return { user, token };
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, department, semester, rollNumber } = req.body;

  if (!isAllowedDomain(email)) {
    throw ApiError.badRequest(
      `Please register with your university email (${config.allowedEmailDomains.map((d) => `*.${d}`).join(', ')}).`
    );
  }
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists.');

  const user = new User({ name, email, password, department, semester, rollNumber, role: 'student' });

  if (!config.requireEmailVerification) {
    user.isVerified = true;
    await user.save();
    logActivity(user._id, 'auth.registered', 'auth', user._id, 'Created an account');
    return sendSuccess(res, issueSession(res, user), 201, 'Account created.');
  }

  const raw = user.createOneTimeToken('verification');
  await user.save();
  const url = `${config.clientUrl}/verify-email/${raw}`;
  const result = await sendVerificationEmail(user, url).catch((err) => {
    console.error('[auth] verification email failed:', err.message);
    return { delivered: false };
  });

  logActivity(user._id, 'auth.registered', 'auth', user._id, 'Created an account');
  return sendSuccess(
    res,
    { email: user.email, requiresVerification: true, ...devLink(result, url) },
    201,
    'Account created. Check your university inbox to verify your email.'
  );
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  // Same message for unknown email and wrong password (no account enumeration).
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password.');
  }
  if (!user.isActive) throw ApiError.forbidden('Your account has been suspended. Contact the administrator.');
  if (config.requireEmailVerification && !user.isVerified) {
    throw ApiError.forbidden('Please verify your email before logging in.', { code: 'EMAIL_NOT_VERIFIED' });
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  logActivity(user._id, 'auth.login', 'auth', user._id, 'Logged in');
  sendSuccess(res, issueSession(res, user), 200, 'Logged in successfully.');
});

exports.logout = (_req, res) => {
  clearAuthCookie(res);
  sendSuccess(res, null, 200, 'Logged out.');
};

exports.me = (req, res) => sendSuccess(res, { user: req.user });

exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    verificationToken: User.hashToken(req.body.token),
    verificationExpires: { $gt: new Date() },
  });
  if (!user) throw ApiError.badRequest('This verification link is invalid or has expired.');

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  logActivity(user._id, 'auth.verified', 'auth', user._id, 'Verified email address');
  sendSuccess(res, issueSession(res, user), 200, 'Email verified. Welcome to CampusConnect!');
});

exports.resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  let extra = {};
  if (user && !user.isVerified) {
    const raw = user.createOneTimeToken('verification');
    await user.save({ validateBeforeSave: false });
    const url = `${config.clientUrl}/verify-email/${raw}`;
    const result = await sendVerificationEmail(user, url).catch(() => ({ delivered: false }));
    extra = devLink(result, url);
  }
  sendSuccess(res, extra, 200, 'If that account exists and is unverified, a new verification email has been sent.');
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  let extra = {};
  if (user) {
    const raw = user.createOneTimeToken('reset');
    await user.save({ validateBeforeSave: false });
    const url = `${config.clientUrl}/reset-password/${raw}`;
    const result = await sendPasswordResetEmail(user, url).catch(() => ({ delivered: false }));
    extra = devLink(result, url);
  }
  sendSuccess(res, extra, 200, 'If an account exists for that email, a password reset link has been sent.');
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: User.hashToken(req.params.token),
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired.');

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.isVerified = true; // proving access to the inbox also verifies it
  await user.save();
  logActivity(user._id, 'auth.password_reset', 'auth', user._id, 'Reset password');
  sendSuccess(res, issueSession(res, user), 200, 'Password updated. You are now logged in.');
});

exports.updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect.');
  }
  user.password = req.body.newPassword;
  await user.save();
  logActivity(user._id, 'auth.password_changed', 'auth', user._id, 'Changed password');
  sendSuccess(res, issueSession(res, user), 200, 'Password changed successfully.');
});

exports.isAllowedDomain = isAllowedDomain;
