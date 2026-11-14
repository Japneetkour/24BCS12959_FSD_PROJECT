const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter, uploadLimiter } = require('../middleware/rateLimit');
const { uploadResource, uploadAvatar } = require('../middleware/upload');
const v = require('../validators');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const tasks = require('../controllers/taskController');
const groups = require('../controllers/groupController');
const resources = require('../controllers/resourceController');
const events = require('../controllers/eventController');
const announcements = require('../controllers/announcementController');
const notifications = require('../controllers/notificationController');
const insights = require('../controllers/insightController');
const admin = require('../controllers/adminController');

const router = express.Router();
const adminOnly = authorize('admin');

router.get('/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

/* ---------------- Auth (public + session) ---------------- */
const authRouter = express.Router();
authRouter.post('/register', authLimiter, v.auth.register, validate, auth.register);
authRouter.post('/login', authLimiter, v.auth.login, validate, auth.login);
authRouter.post('/logout', auth.logout);
authRouter.post('/verify-email', authLimiter, v.auth.token, validate, auth.verifyEmail);
authRouter.post('/resend-verification', authLimiter, v.auth.email, validate, auth.resendVerification);
authRouter.post('/forgot-password', authLimiter, v.auth.email, validate, auth.forgotPassword);
authRouter.post('/reset-password/:token', authLimiter, v.auth.reset, validate, auth.resetPassword);
authRouter.get('/me', protect, auth.me);
authRouter.patch('/update-password', protect, v.auth.updatePassword, validate, auth.updatePassword);
router.use('/auth', authRouter);

/* Everything below requires a valid session. */
router.use(protect);

/* ---------------- Users ---------------- */
router.patch('/users/me', v.user.updateMe, validate, users.updateMe);
router.post('/users/me/avatar', uploadLimiter, uploadAvatar, users.uploadAvatar);
router.get('/users/me/bookmarks', users.getBookmarks);
router.get('/users/search', users.searchUsers);

/* ---------------- Tasks ---------------- */
router.get('/tasks', tasks.getTasks);
router.post('/tasks', v.task.create, validate, tasks.createTask);
router.get('/tasks/stats', tasks.getStats);
router.get('/tasks/smart', tasks.getSmartList);
router.get('/tasks/subjects', tasks.getSubjects);
router.get('/tasks/:id', v.task.id, validate, tasks.getTask);
router.patch('/tasks/:id', v.task.update, validate, tasks.updateTask);
router.patch('/tasks/:id/toggle', v.task.id, validate, tasks.toggleTask);
router.delete('/tasks/:id', v.task.id, validate, tasks.deleteTask);

/* ---------------- Study groups ---------------- */
router.get('/groups', groups.getGroups);
router.post('/groups', v.group.create, validate, groups.createGroup);
router.get('/groups/invites', groups.getMyInvites);
router.get('/groups/subjects', groups.getSubjects);
router.get('/groups/:id', v.group.id, validate, groups.getGroup);
router.patch('/groups/:id', v.group.update, validate, groups.updateGroup);
router.delete('/groups/:id', v.group.id, validate, groups.deleteGroup);
router.post('/groups/:id/join', v.group.id, validate, groups.joinGroup);
router.post('/groups/:id/leave', v.group.id, validate, groups.leaveGroup);
router.post('/groups/:id/invite', v.group.invite, validate, groups.inviteMember);
router.post('/groups/:id/invite/respond', v.group.respond, validate, groups.respondToInvite);
router.patch('/groups/:id/members/:userId', v.group.memberRole, validate, groups.updateMemberRole);
router.delete('/groups/:id/members/:userId', v.group.member, validate, groups.removeMember);
router.get('/groups/:id/messages', v.group.id, validate, groups.getMessages);
router.post('/groups/:id/messages', v.group.message, validate, groups.postMessage);

/* ---------------- Resources ---------------- */
router.get('/resources', resources.getResources);
router.get('/resources/filters', resources.getFilters);
router.post('/resources', uploadLimiter, uploadResource, v.resource.create, validate, resources.createResource);
router.get('/resources/:id', v.resource.id, validate, resources.getResource);
router.patch('/resources/:id', v.resource.update, validate, resources.updateResource);
router.delete('/resources/:id', v.resource.id, validate, resources.deleteResource);
router.get('/resources/:id/download', v.resource.id, validate, resources.downloadResource);
router.post('/resources/:id/bookmark', v.resource.id, validate, resources.toggleBookmark);

/* ---------------- Events ---------------- */
router.get('/events', events.getEvents);
router.get('/events/registered', events.getMyRegistrations);
router.post('/events', adminOnly, v.event.create, validate, events.createEvent);
router.get('/events/:id', v.event.id, validate, events.getEvent);
router.patch('/events/:id', adminOnly, v.event.update, validate, events.updateEvent);
router.delete('/events/:id', adminOnly, v.event.id, validate, events.deleteEvent);
router.post('/events/:id/register', v.event.id, validate, events.register);
router.delete('/events/:id/register', v.event.id, validate, events.unregister);
router.get('/events/:id/participants', adminOnly, v.event.id, validate, events.getParticipants);

/* ---------------- Announcements ---------------- */
router.get('/announcements', announcements.getAnnouncements);
router.post('/announcements', adminOnly, v.announcement.create, validate, announcements.createAnnouncement);
router.get('/announcements/:id', v.announcement.id, validate, announcements.getAnnouncement);
router.patch('/announcements/:id', adminOnly, v.announcement.update, validate, announcements.updateAnnouncement);
router.delete('/announcements/:id', adminOnly, v.announcement.id, validate, announcements.deleteAnnouncement);

/* ---------------- Notifications ---------------- */
router.get('/notifications', notifications.getNotifications);
router.get('/notifications/unread-count', notifications.getUnreadCount);
router.patch('/notifications/read-all', notifications.markAllRead);
router.delete('/notifications/read', notifications.clearRead);
router.patch('/notifications/:id/read', v.objectId('id'), validate, notifications.markRead);
router.delete('/notifications/:id', v.objectId('id'), validate, notifications.deleteNotification);

/* ---------------- Insights ---------------- */
router.get('/dashboard', insights.getDashboard);
router.get('/analytics/me', insights.getMyAnalytics);
router.get('/calendar', v.calendar, validate, insights.getCalendar);
router.get('/search', insights.globalSearch);
router.get('/activity', insights.getActivity);

/* ---------------- Admin ---------------- */
const adminRouter = express.Router();
adminRouter.use(adminOnly);
adminRouter.get('/stats', admin.getStats);
adminRouter.get('/users', admin.getUsers);
adminRouter.get('/users/:id', v.admin.id, validate, admin.getUser);
adminRouter.patch('/users/:id', v.admin.updateUser, validate, admin.updateUser);
adminRouter.delete('/users/:id', v.admin.id, validate, admin.deleteUser);
adminRouter.get('/resources', admin.getResources);
router.use('/admin', adminRouter);

module.exports = router;
