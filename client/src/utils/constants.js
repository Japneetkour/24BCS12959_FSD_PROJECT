export const DEPARTMENTS = [
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

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const PRIORITIES = ['high', 'medium', 'low'];
export const TASK_STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

export const RESOURCE_TYPES = [
  { value: 'notes', label: 'Notes' },
  { value: 'pdf', label: 'PDF' },
  { value: 'slides', label: 'Slides' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'question_paper', label: 'Question paper' },
  { value: 'book', label: 'Book' },
  { value: 'other', label: 'Other' },
];

export const EVENT_CATEGORIES = ['academic', 'technical', 'cultural', 'sports', 'workshop', 'seminar', 'career', 'other'];
export const ANNOUNCEMENT_CATEGORIES = ['general', 'academic', 'exam', 'event', 'placement', 'urgent'];

export const ACCEPTED_FILES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.zip,.png,.jpg,.jpeg';

/** Tailwind classes per semantic tone (light + dark). */
export const TONES = {
  gray: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  pink: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
};

export const PRIORITY_TONE = { high: 'red', medium: 'amber', low: 'green' };
export const STATUS_TONE = { todo: 'gray', in_progress: 'sky', completed: 'green' };
export const EVENT_TONE = {
  academic: 'brand', technical: 'sky', cultural: 'pink', sports: 'green', workshop: 'amber', seminar: 'violet', career: 'brand', other: 'gray',
};
export const ANNOUNCEMENT_TONE = { general: 'gray', academic: 'brand', exam: 'red', event: 'pink', placement: 'violet', urgent: 'red' };

/**
 * Categorical chart palettes, validated (lightness band, CVD separation, contrast)
 * separately for each surface. Fixed order — series keep their hue across filters.
 */
export const CHART_LIGHT = {
  brand: '#6461f6', green: '#10b981', amber: '#f59e0b', sky: '#0ea5e9', red: '#f43f5e', violet: '#a855f7',
  grid: '#e7e9ef', axis: '#8f96a8', surface: '#ffffff',
};
export const CHART_DARK = {
  brand: '#6461f6', green: '#059669', amber: '#d97706', sky: '#0284c7', red: '#f43f5e', violet: '#a855f7',
  grid: '#262b3b', axis: '#687087', surface: '#121521',
};
export const seriesOf = (c) => [c.brand, c.green, c.amber, c.sky, c.red, c.violet];
