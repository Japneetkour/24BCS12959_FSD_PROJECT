const {
  Task, Event, EventRegistration, Announcement, StudyGroup, Resource, Notification, Activity, Message,
} = require('../models');
const {
  asyncHandler, sendSuccess, getPagination, paginated, searchRegex, addDays, startOfDay, SERVER_TZ,
} = require('../utils/helpers');
const { rankTasks } = require('../services/priorityService');
const { computeTaskStats } = require('./taskController');

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

async function attachRegistered(events, userId) {
  const regs = await EventRegistration.find({ user: userId, event: { $in: events.map((e) => e._id) } }).distinct('event');
  const set = new Set(regs.map(String));
  return events.map((e) => ({ ...e, isRegistered: set.has(String(e._id)) }));
}

/** GET /api/dashboard â€” everything the student home page needs in one round trip. */
exports.getDashboard = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const now = new Date();
  const weekAgo = startOfDay(addDays(now, -6));

  const [stats, upcoming, assignments, pendingTasks, events, announcements, groupCount, unread, completedRecently, invites] =
    await Promise.all([
      computeTaskStats(me),
      Task.find({ user: me, status: { $ne: 'completed' }, dueDate: { $gte: now } }).sort({ dueDate: 1 }).limit(6),
      Task.find({ user: me, type: 'assignment', status: { $ne: 'completed' } }).sort({ dueDate: 1 }).limit(5),
      Task.find({ user: me, status: { $ne: 'completed' } }),
      Event.find({ isPublished: true, endDate: { $gte: now } }).sort({ startDate: 1 }).limit(4).lean(),
      Announcement.find(req.user.role === 'admin' ? {} : Announcement.audienceFilter(req.user))
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(4)
        .populate('author', 'name')
        .lean(),
      StudyGroup.countDocuments({ 'members.user': me }),
      Notification.countDocuments({ recipient: me, isRead: false }),
      Task.find({ user: me, status: 'completed', completedAt: { $gte: weekAgo } }).select('completedAt').lean(),
      StudyGroup.countDocuments({ 'invites.user': me }),
    ]);

  // Completed-per-day for the last 7 days (sparkline on the dashboard).
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekAgo, i);
    return { date: dayKey(d), label: d.toLocaleDateString('en-US', { weekday: 'short' }), completed: 0 };
  });
  completedRecently.forEach((t) => {
    const row = weekly.find((w) => w.date === dayKey(t.completedAt));
    if (row) row.completed += 1;
  });

  sendSuccess(res, {
    stats: { ...stats, groups: groupCount, unreadNotifications: unread, pendingInvites: invites },
    upcomingDeadlines: upcoming,
    pendingAssignments: assignments,
    focus: rankTasks(pendingTasks).slice(0, 3),
    upcomingEvents: await attachRegistered(events, me),
    recentAnnouncements: announcements,
    weeklyCompletion: weekly,
  });
});

/** GET /api/analytics/me â€” personal academic analytics. */
exports.getMyAnalytics = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const now = new Date();
  const weeks = 8;
  // Weeks start on Monday.
  const thisMonday = startOfDay(addDays(now, -((now.getDay() + 6) % 7)));
  const from = addDays(thisMonday, -7 * (weeks - 1));
  const monthAgo = startOfDay(addDays(now, -29));

  const [stats, created, completed, activity, onTime, uploads, downloadsAgg, groups, registrations, messages] = await Promise.all([
    computeTaskStats(me),
    Task.find({ user: me, createdAt: { $gte: from } }).select('createdAt').lean(),
    Task.find({ user: me, completedAt: { $gte: from } }).select('completedAt').lean(),
    Activity.aggregate([
      { $match: { user: me, createdAt: { $gte: monthAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: SERVER_TZ } }, count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { user: me, status: 'completed', dueDate: { $ne: null }, completedAt: { $ne: null } } },
      { $group: { _id: null, total: { $sum: 1 }, onTime: { $sum: { $cond: [{ $lte: ['$completedAt', '$dueDate'] }, 1, 0] } } } },
    ]),
    Resource.countDocuments({ uploadedBy: me }),
    Resource.aggregate([{ $match: { uploadedBy: me } }, { $group: { _id: null, downloads: { $sum: '$downloads' } } }]),
    StudyGroup.countDocuments({ 'members.user': me }),
    EventRegistration.countDocuments({ user: me }),
    Message.countDocuments({ sender: me, type: 'text' }),
  ]);

  const trend = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(from, i * 7);
    return {
      week: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start,
      end: addDays(start, 7),
      created: 0,
      completed: 0,
    };
  });
  const bucket = (date, key) => {
    const row = trend.find((w) => date >= w.start && date < w.end);
    if (row) row[key] += 1;
  };
  created.forEach((t) => bucket(new Date(t.createdAt), 'created'));
  completed.forEach((t) => bucket(new Date(t.completedAt), 'completed'));

  const activityMap = new Map(activity.map((a) => [a._id, a.count]));
  const activityByDay = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(monthAgo, i);
    return { date: dayKey(d), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: activityMap.get(dayKey(d)) || 0 };
  });

  const ot = onTime[0] || { total: 0, onTime: 0 };
  sendSuccess(res, {
    tasks: stats,
    completionTrend: trend.map(({ week, created: c, completed: d }) => ({ week, created: c, completed: d })),
    activityByDay,
    onTimeRate: ot.total ? Math.round((ot.onTime / ot.total) * 100) : null,
    totals: {
      resourcesUploaded: uploads,
      downloadsReceived: downloadsAgg[0]?.downloads || 0,
      groupsJoined: groups,
      eventsRegistered: registrations,
      messagesSent: messages,
      bookmarks: req.user.bookmarks.length,
    },
  });
});

/** GET /api/calendar?start&end â€” tasks (by due date) + events overlapping the range. */
exports.getCalendar = asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  const me = req.user._id;
  const [tasks, events] = await Promise.all([
    Task.find({ user: me, dueDate: { $gte: start, $lte: end } }).lean(),
    Event.find({ isPublished: true, startDate: { $lte: end }, endDate: { $gte: start } }).lean(),
  ]);
  const regs = new Set(
    (await EventRegistration.find({ user: me, event: { $in: events.map((e) => e._id) } }).distinct('event')).map(String)
  );
  const items = [
    ...tasks.map((t) => ({
      id: String(t._id),
      kind: t.type === 'assignment' ? 'assignment' : 'task',
      title: t.title,
      start: t.dueDate,
      end: t.dueDate,
      priority: t.priority,
      status: t.status,
      subject: t.subject,
      link: '/tasks',
    })),
    ...events.map((e) => ({
      id: String(e._id),
      kind: 'event',
      title: e.title,
      start: e.startDate,
      end: e.endDate,
      venue: e.venue,
      category: e.category,
      isRegistered: regs.has(String(e._id)),
      link: `/events/${e._id}`,
    })),
  ].sort((a, b) => new Date(a.start) - new Date(b.start));
  sendSuccess(res, items);
});

/** GET /api/search?q= â€” global search across the platform (only what the user may see). */
exports.globalSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  const empty = { resources: [], groups: [], events: [], announcements: [], tasks: [] };
  if (q.length < 2) return sendSuccess(res, { query: q, ...empty, total: 0 });

  const rx = searchRegex(q);
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);
  const me = req.user._id;
  const isAdmin = req.user.role === 'admin';
  const groupIds = (await StudyGroup.find({ 'members.user': me }).select('_id').lean()).map((g) => g._id);

  const [resources, groups, events, announcements, tasks] = await Promise.all([
    Resource.find({
      $and: [
        isAdmin ? {} : { $or: [{ group: null }, { group: { $in: groupIds } }] },
        { $or: [{ title: rx }, { description: rx }, { subject: rx }, { tags: rx }] },
      ],
    })
      .select('title subject semester type')
      .limit(limit)
      .lean(),
    StudyGroup.find({
      $and: [
        isAdmin ? {} : { $or: [{ isPrivate: false }, { _id: { $in: groupIds } }] },
        { $or: [{ name: rx }, { description: rx }, { subject: rx }, { tags: rx }] },
      ],
    })
      .select('name subject members isPrivate')
      .limit(limit)
      .lean(),
    Event.find({ ...(isAdmin ? {} : { isPublished: true }), $or: [{ title: rx }, { description: rx }, { venue: rx }] })
      .select('title startDate venue category')
      .sort({ startDate: -1 })
      .limit(limit)
      .lean(),
    Announcement.find({ ...(isAdmin ? {} : Announcement.audienceFilter(req.user)), $or: [{ title: rx }, { content: rx }] })
      .select('title category createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Task.find({ user: me, $or: [{ title: rx }, { description: rx }, { subject: rx }] })
      .select('title subject dueDate status priority')
      .limit(limit)
      .lean(),
  ]);

  const result = {
    query: q,
    resources,
    groups: groups.map(({ members, ...g }) => ({ ...g, memberCount: members.length })),
    events,
    announcements,
    tasks,
  };
  result.total = resources.length + groups.length + events.length + announcements.length + tasks.length;
  return sendSuccess(res, result);
});

/** GET /api/activity â€” the user's own activity history. */
exports.getActivity = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = { user: req.user._id };
  if (req.query.entityType) filter.entityType = req.query.entityType;
  const [items, total] = await Promise.all([
    Activity.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit),
    Activity.countDocuments(filter),
  ]);
  sendSuccess(res, paginated(items, total, pg));
});

