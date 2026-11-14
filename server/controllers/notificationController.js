const { Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, sendSuccess, getPagination, paginated } = require('../utils/helpers');

exports.getNotifications = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 15 });
  const filter = { recipient: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;
  if (req.query.type) filter.type = req.query.type;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);
  sendSuccess(res, { ...paginated(items, total, pg), unread });
});

exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  sendSuccess(res, { count });
});

exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true }, { new: true });
  if (!n) throw ApiError.notFound('Notification not found.');
  sendSuccess(res, n);
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
  sendSuccess(res, { updated: result.modifiedCount }, 200, 'All notifications marked as read.');
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  if (!n) throw ApiError.notFound('Notification not found.');
  sendSuccess(res, { id: n._id });
});

exports.clearRead = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({ recipient: req.user._id, isRead: true });
  sendSuccess(res, { deleted: result.deletedCount }, 200, 'Read notifications cleared.');
});
