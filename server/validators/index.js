const { body, param, query } = require('express-validator');
const C = require('../utils/constants');

const objectId = (field, where = param) => where(field).isMongoId().withMessage(`Invalid ${field}`);
const password = (field = 'password') =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8–128 characters')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain a number');

const optionalDate = (field) =>
  body(field).optional({ values: 'null' }).isISO8601().withMessage(`${field} must be a valid date`).toDate();
const tags = body('tags').optional().isArray({ max: 10 }).withMessage('Up to 10 tags allowed');

const auth = {
  register: [
    body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),
    body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
    password(),
    body('department').optional().isIn(C.DEPARTMENTS).withMessage('Invalid department'),
    body('semester').optional().isInt({ min: 1, max: 10 }).withMessage('Semester must be 1–10').toInt(),
    body('rollNumber').optional().trim().isLength({ max: 30 }),
  ],
  login: [
    body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  email: [body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false })],
  token: [body('token').isString().isLength({ min: 20, max: 200 }).withMessage('Invalid token')],
  reset: [param('token').isString().isLength({ min: 20, max: 200 }).withMessage('Invalid token'), password()],
  updatePassword: [
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    password('newPassword'),
  ],
};

const user = {
  updateMe: [
    body('name').optional().trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),
    body('department').optional().isIn(C.DEPARTMENTS).withMessage('Invalid department'),
    body('semester').optional().isInt({ min: 1, max: 10 }).withMessage('Semester must be 1–10').toInt(),
    body('rollNumber').optional().trim().isLength({ max: 30 }),
    body('bio').optional().trim().isLength({ max: 300 }).withMessage('Bio can be at most 300 characters'),
  ],
};

const taskFields = (isUpdate) => [
  (isUpdate ? body('title').optional() : body('title'))
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Title must be 2–120 characters'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('subject').optional().trim().isLength({ max: 60 }),
  body('type').optional().isIn(C.TASK_TYPES).withMessage('Invalid task type'),
  body('priority').optional().isIn(C.TASK_PRIORITIES).withMessage('Priority must be low, medium or high'),
  body('status').optional().isIn(C.TASK_STATUSES).withMessage('Invalid status'),
  optionalDate('dueDate'),
  optionalDate('reminderAt'),
  tags,
];

const task = {
  create: taskFields(false),
  update: [objectId('id'), ...taskFields(true)],
  id: [objectId('id')],
};

const groupFields = (isUpdate) => [
  (isUpdate ? body('name').optional() : body('name')).trim().isLength({ min: 3, max: 80 }).withMessage('Name must be 3–80 characters'),
  (isUpdate ? body('subject').optional() : body('subject')).trim().isLength({ min: 2, max: 60 }).withMessage('Subject is required'),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('isPrivate').optional().isBoolean().toBoolean(),
  body('maxMembers').optional().isInt({ min: 2, max: 200 }).withMessage('Max members must be 2–200').toInt(),
  tags,
];

const group = {
  create: groupFields(false),
  update: [objectId('id'), ...groupFields(true)],
  id: [objectId('id')],
  invite: [objectId('id'), body('email').trim().isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false })],
  respond: [objectId('id'), body('accept').isBoolean().withMessage('accept must be true or false').toBoolean()],
  member: [objectId('id'), objectId('userId')],
  memberRole: [objectId('id'), objectId('userId'), body('role').isIn(['owner', 'admin', 'member']).withMessage('Role must be owner, admin or member')],
  message: [objectId('id'), body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1–2000 characters')],
};

const resourceFields = (isUpdate) => [
  (isUpdate ? body('title').optional() : body('title')).trim().isLength({ min: 3, max: 120 }).withMessage('Title must be 3–120 characters'),
  (isUpdate ? body('subject').optional() : body('subject')).trim().isLength({ min: 2, max: 60 }).withMessage('Subject is required'),
  (isUpdate ? body('semester').optional() : body('semester')).isInt({ min: 1, max: 10 }).withMessage('Semester must be 1–10').toInt(),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('type').optional().isIn(C.RESOURCE_TYPES).withMessage('Invalid resource type'),
  body('group').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid group'),
];

const resource = {
  create: resourceFields(false),
  update: [objectId('id'), ...resourceFields(true)],
  id: [objectId('id')],
};

const eventFields = (isUpdate) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('title')).trim().isLength({ min: 3, max: 120 }).withMessage('Title must be 3–120 characters'),
    req(body('description')).trim().isLength({ min: 10, max: 5000 }).withMessage('Description must be 10–5000 characters'),
    req(body('venue')).trim().isLength({ min: 2, max: 120 }).withMessage('Venue is required'),
    req(body('startDate')).isISO8601().withMessage('Valid start date required').toDate(),
    req(body('endDate')).isISO8601().withMessage('Valid end date required').toDate(),
    body('category').optional().isIn(C.EVENT_CATEGORIES).withMessage('Invalid category'),
    body('organizer').optional().trim().isLength({ max: 100 }),
    optionalDate('registrationDeadline'),
    body('capacity').optional().isInt({ min: 0, max: 100000 }).withMessage('Capacity must be 0 or more').toInt(),
    body('isPublished').optional().isBoolean().toBoolean(),
  ];
};

const event = {
  create: eventFields(false),
  update: [objectId('id'), ...eventFields(true)],
  id: [objectId('id')],
};

const announcementFields = (isUpdate) => {
  const req = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    req(body('title')).trim().isLength({ min: 3, max: 150 }).withMessage('Title must be 3–150 characters'),
    req(body('content')).trim().isLength({ min: 5, max: 5000 }).withMessage('Content must be 5–5000 characters'),
    body('category').optional().isIn(C.ANNOUNCEMENT_CATEGORIES).withMessage('Invalid category'),
    body('department').optional().isIn(['All', ...C.DEPARTMENTS]).withMessage('Invalid department'),
    body('semester').optional().isInt({ min: 0, max: 10 }).withMessage('Semester must be 0–10').toInt(),
    body('priority').optional().isIn(['normal', 'important']).withMessage('Invalid priority'),
    body('isPinned').optional().isBoolean().toBoolean(),
  ];
};

const announcement = {
  create: announcementFields(false),
  update: [objectId('id'), ...announcementFields(true)],
  id: [objectId('id')],
};

const admin = {
  updateUser: [
    objectId('id'),
    body('role').optional().isIn(C.ROLES).withMessage('Invalid role'),
    body('isActive').optional().isBoolean().toBoolean(),
    body('isVerified').optional().isBoolean().toBoolean(),
  ],
  id: [objectId('id')],
};

const calendar = [
  query('start').isISO8601().withMessage('start must be a date').toDate(),
  query('end').isISO8601().withMessage('end must be a date').toDate(),
];

module.exports = { auth, user, task, group, resource, event, announcement, admin, calendar, objectId };
