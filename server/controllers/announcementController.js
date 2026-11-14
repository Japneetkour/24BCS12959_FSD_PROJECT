const { Announcement, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, sendSuccess, getPagination, paginated, pick, searchRegex } = require('../utils/helpers');
const { notifyManySafe } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');

const FIELDS = ['title', 'content', 'category', 'department', 'semester', 'priority', 'isPinned'];

exports.getAnnouncements = asyncHandler(async (req, res) => {
  const q = req.query;
  const pg = getPagination(q, { defaultLimit: 10 });
  // Students only see announcements targeted at their department & semester.
  const filter = req.user.role === 'admin' ? {} : Announcement.audienceFilter(req.user);
  if (req.user.role === 'admin') {
    if (q.department) filter.department = q.department;
    if (q.semester !== undefined && q.semester !== '') filter.semester = Number(q.semester);
  }
  if (q.category) filter.category = q.category;
  if (q.priority) filter.priority = q.priority;
  if (q.search) {
    const rx = searchRegex(q.search);
    filter.$or = [{ title: rx }, { content: rx }];
  }

  const [items, total] = await Promise.all([
    Announcement.find(filter).sort({ isPinned: -1, createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('author', 'name'),
    Announcement.countDocuments(filter),
  ]);
  sendSuccess(res, paginated(items, total, pg));
});

exports.getAnnouncement = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...(req.user.role === 'admin' ? {} : Announcement.audienceFilter(req.user)) };
  const announcement = await Announcement.findOne(filter).populate('author', 'name');
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  sendSuccess(res, announcement);
});

exports.createAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.create({ ...pick(req.body, FIELDS), author: req.user._id });
  await announcement.populate('author', 'name');

  // Fan out a notification to every student in the target audience.
  const audience = { role: 'student', isActive: true };
  if (announcement.department !== 'All') audience.department = announcement.department;
  if (announcement.semester !== 0) audience.semester = announcement.semester;
  const recipients = await User.find(audience).distinct('_id');
  notifyManySafe(recipients, {
    type: 'announcement',
    title: announcement.priority === 'important' ? `Important: ${announcement.title}` : announcement.title,
    message: announcement.content.slice(0, 140),
    link: `/announcements?highlight=${announcement._id}`,
    meta: { announcementId: announcement._id, category: announcement.category },
  });

  logActivity(req.user._id, 'announcement.created', 'announcement', announcement._id, `Published "${announcement.title}"`);
  sendSuccess(res, { ...announcement.toJSON(), recipients: recipients.length }, 201, `Announcement published to ${recipients.length} student(s).`);
});

exports.updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  Object.assign(announcement, pick(req.body, FIELDS));
  await announcement.save();
  await announcement.populate('author', 'name');
  sendSuccess(res, announcement, 200, 'Announcement updated.');
});

exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  logActivity(req.user._id, 'announcement.deleted', 'announcement', announcement._id, `Deleted "${announcement.title}"`);
  sendSuccess(res, { id: announcement._id }, 200, 'Announcement deleted.');
});
