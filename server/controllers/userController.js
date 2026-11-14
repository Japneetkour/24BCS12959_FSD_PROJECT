const path = require('path');
const { User, Resource } = require('../models');
const { asyncHandler, sendSuccess, pick, searchRegex } = require('../utils/helpers');
const ApiError = require('../utils/ApiError');
const { removeFile, AVATAR_DIR } = require('../middleware/upload');
const { logActivity } = require('../services/activityService');

exports.updateMe = asyncHandler(async (req, res) => {
  const updates = pick(req.body, ['name', 'department', 'semester', 'rollNumber', 'bio']);
  Object.assign(req.user, updates);
  await req.user.save();
  logActivity(req.user._id, 'user.profile_updated', 'user', req.user._id, 'Updated profile');
  sendSuccess(res, { user: req.user }, 200, 'Profile updated.');
});

exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please choose an image to upload.');
  const previous = req.user.avatar;
  req.user.avatar = `/uploads/avatars/${req.file.filename}`;
  await req.user.save({ validateBeforeSave: false });
  if (previous && previous.startsWith('/uploads/avatars/')) {
    removeFile(path.join(AVATAR_DIR, path.basename(previous)));
  }
  sendSuccess(res, { user: req.user }, 200, 'Profile photo updated.');
});

/** Lightweight user lookup (e.g. to invite someone to a study group). */
exports.searchUsers = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return sendSuccess(res, []);
  const rx = searchRegex(q);
  const users = await User.find({
    _id: { $ne: req.user._id },
    isActive: true,
    $or: [{ name: rx }, { email: rx }, { rollNumber: rx }],
  })
    .select('name email department semester avatar')
    .limit(10)
    .lean();
  return sendSuccess(res, users);
});

exports.getBookmarks = asyncHandler(async (req, res) => {
  const resources = await Resource.find({ _id: { $in: req.user.bookmarks } })
    .populate('uploadedBy', 'name avatar')
    .sort('-createdAt');
  sendSuccess(res, resources.map((r) => ({ ...r.toJSON(), isBookmarked: true })));
});
