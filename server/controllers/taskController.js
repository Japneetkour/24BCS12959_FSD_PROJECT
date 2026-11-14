const { Task } = require('../models');
const ApiError = require('../utils/ApiError');
const {
  asyncHandler, sendSuccess, getPagination, paginated, pick, searchRegex, startOfDay, endOfDay, addDays,
} = require('../utils/helpers');
const { rankTasks } = require('../services/priorityService');
const { logActivity } = require('../services/activityService');

const FIELDS = ['title', 'description', 'subject', 'type', 'priority', 'status', 'dueDate', 'reminderAt', 'tags'];

const SORTS = {
  dueDate: { dueDate: 1, priorityRank: -1 },
  '-dueDate': { dueDate: -1 },
  priority: { priorityRank: -1, dueDate: 1 },
  '-createdAt': { createdAt: -1 },
  createdAt: { createdAt: 1 },
  title: { title: 1 },
};

/** Builds the Mongo filter from query-string filters. */
function buildFilter(userId, q) {
  const filter = { user: userId };
  const now = new Date();
  if (q.status) filter.status = q.status === 'pending' ? { $ne: 'completed' } : q.status;
  if (q.priority) filter.priority = q.priority;
  if (q.type) filter.type = q.type;
  if (q.subject) filter.subject = q.subject;
  if (q.search) {
    const rx = searchRegex(q.search);
    filter.$or = [{ title: rx }, { description: rx }, { subject: rx }, { tags: rx }];
  }
  switch (q.due) {
    case 'overdue':
      filter.dueDate = { $lt: now };
      filter.status = { $ne: 'completed' };
      break;
    case 'today':
      filter.dueDate = { $gte: startOfDay(now), $lte: endOfDay(now) };
      break;
    case 'week':
      filter.dueDate = { $gte: now, $lte: addDays(now, 7) };
      break;
    case 'upcoming':
      filter.dueDate = { $gte: now };
      break;
    case 'none':
      filter.dueDate = { $exists: false };
      break;
    default:
  }
  return filter;
}

async function findOwnTask(req) {
  const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
  if (!task) throw ApiError.notFound('Task not found.');
  return task;
}

exports.getTasks = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.user._id, req.query);
  const pg = getPagination(req.query, { defaultLimit: 20 });

  if (req.query.sort === 'smart') {
    // Smart ranking is computed in the app layer (per-user task lists are small).
    const all = await Task.find(filter);
    const ranked = rankTasks(all);
    return sendSuccess(res, paginated(ranked.slice(pg.skip, pg.skip + pg.limit), ranked.length, pg));
  }

  const sort = SORTS[req.query.sort] || { status: 1, dueDate: 1 };
  const [items, total] = await Promise.all([
    Task.find(filter).sort(sort).skip(pg.skip).limit(pg.limit),
    Task.countDocuments(filter),
  ]);
  return sendSuccess(res, paginated(items, total, pg));
});

exports.getTask = asyncHandler(async (req, res) => sendSuccess(res, await findOwnTask(req)));

exports.createTask = asyncHandler(async (req, res) => {
  const task = await Task.create({ ...pick(req.body, FIELDS), user: req.user._id });
  logActivity(req.user._id, 'task.created', 'task', task._id, `Created ${task.type} "${task.title}"`);
  sendSuccess(res, task, 201, 'Task created.');
});

exports.updateTask = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req);
  const wasCompleted = task.status === 'completed';
  Object.assign(task, pick(req.body, FIELDS));
  // Allow clearing optional dates by sending null.
  ['dueDate', 'reminderAt'].forEach((f) => { if (req.body[f] === null) task[f] = undefined; });
  await task.save();

  const action = !wasCompleted && task.status === 'completed' ? 'completed' : 'updated';
  logActivity(req.user._id, `task.${action}`, 'task', task._id, `${action === 'completed' ? 'Completed' : 'Updated'} "${task.title}"`);
  sendSuccess(res, task, 200, 'Task updated.');
});

exports.toggleTask = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req);
  task.status = task.status === 'completed' ? 'todo' : 'completed';
  await task.save();
  if (task.status === 'completed') {
    logActivity(req.user._id, 'task.completed', 'task', task._id, `Completed "${task.title}"`);
  }
  sendSuccess(res, task, 200, task.status === 'completed' ? 'Marked as completed.' : 'Marked as pending.');
});

exports.deleteTask = asyncHandler(async (req, res) => {
  const task = await findOwnTask(req);
  await task.deleteOne();
  logActivity(req.user._id, 'task.deleted', 'task', task._id, `Deleted "${task.title}"`);
  sendSuccess(res, { id: task._id }, 200, 'Task deleted.');
});

/** Aggregated personal statistics (also reused by the dashboard). */
async function computeTaskStats(userId) {
  const now = new Date();
  const [totals] = await Task.aggregate([
    { $match: { user: userId } },
    {
      $facet: {
        counts: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
              overdue: {
                $sum: {
                  $cond: [{ $and: [{ $ne: ['$status', 'completed'] }, { $lt: ['$dueDate', now] }, { $ne: ['$dueDate', null] }] }, 1, 0],
                },
              },
              dueThisWeek: {
                $sum: {
                  $cond: [
                    { $and: [{ $ne: ['$status', 'completed'] }, { $gte: ['$dueDate', now] }, { $lte: ['$dueDate', addDays(now, 7)] }] },
                    1,
                    0,
                  ],
                },
              },
              pendingAssignments: {
                $sum: { $cond: [{ $and: [{ $eq: ['$type', 'assignment'] }, { $ne: ['$status', 'completed'] }] }, 1, 0] },
              },
            },
          },
        ],
        byPriority: [
          {
            $group: {
              _id: '$priority',
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            },
          },
        ],
        bySubject: [
          {
            $group: {
              _id: '$subject',
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 8 },
        ],
      },
    },
  ]);

  const c = totals.counts[0] || { total: 0, completed: 0, inProgress: 0, overdue: 0, dueThisWeek: 0, pendingAssignments: 0 };
  delete c._id;
  return {
    ...c,
    pending: c.total - c.completed,
    completionRate: c.total ? Math.round((c.completed / c.total) * 100) : 0,
    byPriority: ['high', 'medium', 'low'].map((p) => {
      const row = totals.byPriority.find((r) => r._id === p) || { total: 0, completed: 0 };
      return { priority: p, total: row.total, completed: row.completed };
    }),
    bySubject: totals.bySubject.map((r) => ({ subject: r._id || 'General', total: r.total, completed: r.completed })),
  };
}
exports.computeTaskStats = computeTaskStats;

exports.getStats = asyncHandler(async (req, res) => sendSuccess(res, await computeTaskStats(req.user._id)));

exports.getSmartList = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 50);
  const pending = await Task.find({ user: req.user._id, status: { $ne: 'completed' } });
  sendSuccess(res, rankTasks(pending).slice(0, limit));
});

exports.getSubjects = asyncHandler(async (req, res) => {
  const subjects = await Task.distinct('subject', { user: req.user._id });
  sendSuccess(res, subjects.filter(Boolean).sort());
});
