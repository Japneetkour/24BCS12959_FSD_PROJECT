const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics',
  'Electrical',
  'Mechanical',
  'Civil',
  'Business Administration',
  'Mathematics',
  'Other',
];

module.exports = {
  ROLES: ['student', 'admin'],
  DEPARTMENTS,
  TASK_PRIORITIES: ['low', 'medium', 'high'],
  PRIORITY_RANK: { low: 1, medium: 2, high: 3 },
  TASK_STATUSES: ['todo', 'in_progress', 'completed'],
  TASK_TYPES: ['task', 'assignment'],
  GROUP_ROLES: ['owner', 'admin', 'member'],
  RESOURCE_TYPES: ['notes', 'pdf', 'slides', 'assignment', 'question_paper', 'book', 'other'],
  EVENT_CATEGORIES: ['academic', 'technical', 'cultural', 'sports', 'workshop', 'seminar', 'career', 'other'],
  ANNOUNCEMENT_CATEGORIES: ['general', 'academic', 'exam', 'event', 'placement', 'urgent'],
  NOTIFICATION_TYPES: ['announcement', 'deadline', 'reminder', 'group_invite', 'group', 'event', 'system'],
  ACTIVITY_ENTITIES: ['auth', 'user', 'task', 'group', 'resource', 'event', 'announcement'],
};
