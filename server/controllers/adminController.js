const path = require('path');
const {
  User, Task, StudyGroup, Message, Resource, Event, EventRegistration, Announcement, Notification, Activity,
} = require('../models');
const ApiError = require('../utils/ApiError');
const {
  asyncHandler, sendSuccess, getPagination, paginated, searchRegex, addDays, startOfDay, idEquals, SERVER_TZ,
} = require('../utils/helpers');
const { removeFile, RESOURCE_DIR } = require('../middleware/upload');
const { notifySafe } = require('../services/notificationService');

/** GET /api/admin/stats â€” platform-wide numbers and chart data. */
exports.getStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const twoWeeksAgo = startOfDay(addDays(now, -13));

  const [
    userCounts, newThisWeek, taskAgg, groups, messages, resourceAgg, events, upcomingEvents, registrations,
    announcements, growth, byDepartment, bySubject, topEvents, activity,
  ] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          students: { $sum: { $cond: [{ $eq: ['$role', 'student'] }, 1, 0] } },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
          suspended: { $sum: { $cond: ['$isActive', 0, 1] } },
        },
      },
    ]),
    User.countDocuments({ role: 'student', createdAt: { $gte: addDays(now, -7) } }),
    Task.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
    ]),
    StudyGroup.countDocuments(),
    Message.countDocuments({ type: { $ne: 'system' } }),
    Resource.aggregate([{ $group: { _id: null, total: { $sum: 1 }, downloads: { $sum: '$downloads' }, storage: { $sum: '$file.size' } } }]),
    Event.countDocuments(),
    Event.countDocuments({ endDate: { $gte: now } }),
    EventRegistration.countDocuments(),
    Announcement.countDocuments(),
    User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { y: { $year: { date: '$createdAt', timezone: SERVER_TZ } }, m: { $month: { date: '$createdAt', timezone: SERVER_TZ } } }, count: { $sum: 1 } } },
    ]),
    User.aggregate([{ $match: { role: 'student' } }, { $group: { _id: '$department', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Resource.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 }, downloads: { $sum: '$downloads' } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Event.find().sort({ registrationsCount: -1 }).limit(5).select('title registrationsCount capacity startDate').lean(),
    Activity.aggregate([
      { $match: { createdAt: { $gte: twoWeeksAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: SERVER_TZ } }, count: { $sum: 1 } } },
    ]),
  ]);

  const u = userCounts[0] || { total: 0, students: 0, admins: 0, verified: 0, suspended: 0 };
  const t = taskAgg[0] || { total: 0, completed: 0 };
  const r = resourceAgg[0] || { total: 0, downloads: 0, storage: 0 };

  const userGrowth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
    const row = growth.find((g) => g._id.y === d.getFullYear() && g._id.m === d.getMonth() + 1);
    return { month: d.toLocaleDateString('en-US', { month: 'short' }), users: row ? row.count : 0 };
  });

  const activityMap = new Map(activity.map((a) => [a._id, a.count]));
  const activityTrend = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(twoWeeksAgo, i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: activityMap.get(key) || 0 };
  });

  sendSuccess(res, {
    users: { ...u, _id: undefined, newThisWeek },
    tasks: { ...t, _id: undefined, completionRate: t.total ? Math.round((t.completed / t.total) * 100) : 0 },
    groups,
    messages,
    resources: { total: r.total, downloads: r.downloads, storageBytes: r.storage },
    events: { total: events, upcoming: upcomingEvents, registrations },
    announcements,
    charts: {
      userGrowth,
      byDepartment: byDepartment.map((d) => ({ department: d._id, count: d.count })),
      resourcesBySubject: bySubject.map((s) => ({ subject: s._id, count: s.count, downloads: s.downloads })),
      topEvents,
      activityTrend,
    },
  });
});

exports.getUsers = asyncHandler(async (req, res) => {
  const q = req.query;
  const pg = getPagination(q, { defaultLimit: 15 });
  const filter = {};
  if (q.role) filter.role = q.role;
  if (q.department) filter.department = q.department;
  if (q.status === 'active') filter.isActive = true;
  if (q.status === 'suspended') filter.isActive = false;
  if (q.status === 'unverified') filter.isVerified = false;
  if (q.search) {
    const rx = searchRegex(q.search);
    filter.$or = [{ name: rx }, { email: rx }, { rollNumber: rx }];
  }
  const sort = { name: { name: 1 }, oldest: { createdAt: 1 }, lastLogin: { lastLoginAt: -1 } }[q.sort] || { createdAt: -1 };
  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(pg.skip).limit(pg.limit),
    User.countDocuments(filter),
  ]);
  sendSuccess(res, paginated(items, total, pg));
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  const [tasks, completed, resources, groups, registrations, activity] = await Promise.all([
    Task.countDocuments({ user: user._id }),
    Task.countDocuments({ user: user._id, status: 'completed' }),
    Resource.countDocuments({ uploadedBy: user._id }),
    StudyGroup.countDocuments({ 'members.user': user._id }),
    EventRegistration.countDocuments({ user: user._id }),
    Activity.find({ user: user._id }).sort({ createdAt: -1 }).limit(10),
  ]);
  sendSuccess(res, { user, stats: { tasks, completed, resources, groups, registrations }, recentActivity: activity });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  if (idEquals(user._id, req.user._id) && (req.body.role !== undefined || req.body.isActive === false)) {
    throw ApiError.badRequest('You cannot change your own role or suspend your own account.');
  }
  ['role', 'isActive', 'isVerified'].forEach((f) => { if (req.body[f] !== undefined) user[f] = req.body[f]; });
  await user.save({ validateBeforeSave: false });

  if (req.body.isActive !== undefined) {
    notifySafe(user._id, {
      type: 'system',
      title: user.isActive ? 'Account reactivated' : 'Account suspended',
      message: user.isActive ? 'Your account has been reactivated by an administrator.' : 'Your account was suspended by an administrator.',
    });
  }
  sendSuccess(res, user, 200, 'User updated.');
});

/** Deletes a user and cleans up everything that references them. */
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  if (idEquals(user._id, req.user._id)) throw ApiError.badRequest('You cannot delete your own account.');

  // Free event seats held by this user.
  const regs = await EventRegistration.find({ user: user._id }).select('event').lean();
  await Promise.all(regs.map((r) => Event.updateOne({ _id: r.event, registrationsCount: { $gt: 0 } }, { $inc: { registrationsCount: -1 } })));

  // Owned groups: hand ownership to the next member, or delete empty groups.
  const owned = await StudyGroup.find({ owner: user._id });
  for (const group of owned) {
    const others = group.members.filter((m) => !idEquals(m.user, user._id));
    if (!others.length) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all([Message.deleteMany({ group: group._id }), group.deleteOne()]);
    } else {
      const heir = others.find((m) => m.role === 'admin') || others[0];
      heir.role = 'owner';
      group.owner = heir.user;
      group.members = others;
      // eslint-disable-next-line no-await-in-loop
      await group.save();
    }
  }

  const resources = await Resource.find({ uploadedBy: user._id }).select('file.filename').lean();
  resources.forEach((r) => removeFile(path.join(RESOURCE_DIR, r.file.filename)));

  await Promise.all([
    StudyGroup.updateMany({}, { $pull: { members: { user: user._id }, invites: { user: user._id } } }),
    Resource.deleteMany({ uploadedBy: user._id }),
    User.updateMany({}, { $pull: { bookmarks: { $in: resources.map((r) => r._id) } } }),
    Task.deleteMany({ user: user._id }),
    EventRegistration.deleteMany({ user: user._id }),
    Notification.deleteMany({ recipient: user._id }),
    Activity.deleteMany({ user: user._id }),
    user.deleteOne(),
  ]);
  sendSuccess(res, { id: user._id }, 200, `${user.name}'s account was deleted.`);
});

exports.getResources = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 15 });
  const filter = {};
  if (req.query.search) {
    const rx = searchRegex(req.query.search);
    filter.$or = [{ title: rx }, { subject: rx }, { 'file.originalName': rx }];
  }
  const sort = { popular: { downloads: -1 }, size: { 'file.size': -1 } }[req.query.sort] || { createdAt: -1 };
  const [items, total] = await Promise.all([
    Resource.find(filter).sort(sort).skip(pg.skip).limit(pg.limit).populate('uploadedBy', 'name email').populate('group', 'name'),
    Resource.countDocuments(filter),
  ]);
  sendSuccess(res, paginated(items, total, pg));
});
