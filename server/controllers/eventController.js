const { Event, EventRegistration, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { asyncHandler, sendSuccess, getPagination, paginated, pick, searchRegex } = require('../utils/helpers');
const { notifySafe, notifyManySafe } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');

const FIELDS = ['title', 'description', 'category', 'venue', 'organizer', 'startDate', 'endDate', 'registrationDeadline', 'capacity', 'isPublished'];

/** Adds isRegistered / spotsLeft / registrationOpen for the current user. */
async function withRegistration(events, userId) {
  const list = Array.isArray(events) ? events : [events];
  const regs = await EventRegistration.find({ user: userId, event: { $in: list.map((e) => e._id) } }).select('event').lean();
  const registered = new Set(regs.map((r) => String(r.event)));
  const now = new Date();
  const out = list.map((e) => {
    const obj = typeof e.toJSON === 'function' ? e.toJSON() : e;
    const isFull = obj.capacity > 0 && obj.registrationsCount >= obj.capacity;
    const deadlinePassed = obj.registrationDeadline && new Date(obj.registrationDeadline) < now;
    return {
      ...obj,
      spotsLeft: obj.capacity > 0 ? Math.max(0, obj.capacity - obj.registrationsCount) : null,
      isRegistered: registered.has(String(obj._id)),
      isPast: new Date(obj.endDate) < now,
      registrationOpen: obj.isPublished && new Date(obj.endDate) >= now && !deadlinePassed && !isFull,
    };
  });
  return Array.isArray(events) ? out : out[0];
}

exports.getEvents = asyncHandler(async (req, res) => {
  const q = req.query;
  const pg = getPagination(q, { defaultLimit: 12 });
  const now = new Date();
  const filter = {};
  if (req.user.role !== 'admin') filter.isPublished = true;
  if (q.category) filter.category = q.category;
  if (q.search) {
    const rx = searchRegex(q.search);
    filter.$or = [{ title: rx }, { description: rx }, { venue: rx }, { organizer: rx }];
  }
  let sort = { startDate: 1 };
  if (q.scope === 'past') {
    filter.endDate = { $lt: now };
    sort = { startDate: -1 };
  } else if (q.scope !== 'all') {
    filter.endDate = { $gte: now };
  }

  const [events, total] = await Promise.all([
    Event.find(filter).sort(sort).skip(pg.skip).limit(pg.limit),
    Event.countDocuments(filter),
  ]);
  sendSuccess(res, paginated(await withRegistration(events, req.user._id), total, pg));
});

exports.getMyRegistrations = asyncHandler(async (req, res) => {
  const regs = await EventRegistration.find({ user: req.user._id }).populate('event').sort({ createdAt: -1 }).lean();
  const events = regs.map((r) => r.event).filter(Boolean).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  sendSuccess(res, await withRegistration(events, req.user._id));
});

exports.getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id).populate('createdBy', 'name');
  if (!event || (!event.isPublished && req.user.role !== 'admin')) throw ApiError.notFound('Event not found.');
  sendSuccess(res, await withRegistration(event, req.user._id));
});

exports.createEvent = asyncHandler(async (req, res) => {
  const event = await Event.create({ ...pick(req.body, FIELDS), createdBy: req.user._id });
  logActivity(req.user._id, 'event.created', 'event', event._id, `Created event "${event.title}"`);

  if (event.isPublished) {
    const students = await User.find({ role: 'student', isActive: true }).distinct('_id');
    notifyManySafe(students, {
      type: 'event',
      title: 'New campus event',
      message: `${event.title} · ${event.venue}`,
      link: `/events/${event._id}`,
    });
  }
  sendSuccess(res, await withRegistration(event, req.user._id), 201, 'Event created.');
});

exports.updateEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw ApiError.notFound('Event not found.');
  const updates = pick(req.body, FIELDS);
  if (updates.capacity !== undefined && updates.capacity > 0 && updates.capacity < event.registrationsCount) {
    throw ApiError.badRequest(`Capacity cannot be lower than the ${event.registrationsCount} existing registrations.`);
  }
  if (req.body.registrationDeadline === null) event.registrationDeadline = undefined;
  Object.assign(event, updates);
  await event.save();

  // Tell registered students if the schedule or venue changed.
  const changed = ['startDate', 'endDate', 'venue'].some((f) => updates[f] !== undefined);
  if (changed) {
    const userIds = await EventRegistration.find({ event: event._id }).distinct('user');
    notifyManySafe(userIds, {
      type: 'event',
      title: 'Event updated',
      message: `${event.title} has new details — check the date and venue.`,
      link: `/events/${event._id}`,
    });
  }
  sendSuccess(res, await withRegistration(event, req.user._id), 200, 'Event updated.');
});

exports.deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw ApiError.notFound('Event not found.');
  const userIds = await EventRegistration.find({ event: event._id }).distinct('user');
  await Promise.all([EventRegistration.deleteMany({ event: event._id }), event.deleteOne()]);
  if (new Date(event.endDate) >= new Date()) {
    notifyManySafe(userIds, {
      type: 'event',
      title: 'Event cancelled',
      message: `${event.title} has been cancelled.`,
      link: '/events',
    });
  }
  logActivity(req.user._id, 'event.deleted', 'event', event._id, `Deleted event "${event.title}"`);
  sendSuccess(res, { id: event._id }, 200, 'Event deleted.');
});

exports.register = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  const now = new Date();
  if (!event || !event.isPublished) throw ApiError.notFound('Event not found.');
  if (event.endDate < now) throw ApiError.badRequest('This event has already ended.');
  if (event.registrationDeadline && event.registrationDeadline < now) throw ApiError.badRequest('Registration for this event has closed.');
  if (await EventRegistration.exists({ event: event._id, user: req.user._id })) {
    throw ApiError.badRequest('You are already registered for this event.');
  }

  // Atomic capacity check: only increments if a seat is still free.
  const updated = await Event.findOneAndUpdate(
    { _id: event._id, $or: [{ capacity: 0 }, { $expr: { $lt: ['$registrationsCount', '$capacity'] } }] },
    { $inc: { registrationsCount: 1 } },
    { new: true }
  );
  if (!updated) throw ApiError.badRequest('Sorry, this event is full.');

  try {
    await EventRegistration.create({ event: event._id, user: req.user._id });
  } catch (err) {
    await Event.updateOne({ _id: event._id }, { $inc: { registrationsCount: -1 } }); // roll back the seat
    if (err.code === 11000) throw ApiError.badRequest('You are already registered for this event.');
    throw err;
  }

  logActivity(req.user._id, 'event.registered', 'event', event._id, `Registered for "${event.title}"`);
  notifySafe(req.user._id, {
    type: 'event',
    title: 'Registration confirmed',
    message: `You're registered for ${event.title}.`,
    link: `/events/${event._id}`,
  });
  sendSuccess(res, await withRegistration(updated, req.user._id), 200, 'You are registered!');
});

exports.unregister = asyncHandler(async (req, res) => {
  const reg = await EventRegistration.findOneAndDelete({ event: req.params.id, user: req.user._id });
  if (!reg) throw ApiError.badRequest('You are not registered for this event.');
  const event = await Event.findOneAndUpdate(
    { _id: req.params.id, registrationsCount: { $gt: 0 } },
    { $inc: { registrationsCount: -1 } },
    { new: true }
  );
  logActivity(req.user._id, 'event.unregistered', 'event', req.params.id, `Cancelled registration${event ? ` for "${event.title}"` : ''}`);
  sendSuccess(res, event ? await withRegistration(event, req.user._id) : null, 200, 'Registration cancelled.');
});

exports.getParticipants = asyncHandler(async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 50, maxLimit: 500 });
  const filter = { event: req.params.id };
  const [regs, total] = await Promise.all([
    EventRegistration.find(filter)
      .sort({ createdAt: 1 })
      .skip(pg.skip)
      .limit(pg.limit)
      .populate('user', 'name email department semester rollNumber avatar')
      .lean(),
    EventRegistration.countDocuments(filter),
  ]);
  const items = regs.filter((r) => r.user).map((r) => ({ ...r.user, registeredAt: r.createdAt }));
  sendSuccess(res, paginated(items, total, pg));
});
