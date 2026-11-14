import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, differenceInHours } from 'date-fns';

export const fmtDate = (d, pattern = 'MMM d, yyyy') => (d ? format(new Date(d), pattern) : '—');
export const fmtDateTime = (d) => (d ? format(new Date(d), 'MMM d, yyyy · h:mm a') : '—');
export const fmtTime = (d) => (d ? format(new Date(d), 'h:mm a') : '');
export const timeAgo = (d) => (d ? `${formatDistanceToNowStrict(new Date(d))} ago` : '');

/** "Today, 5:00 PM" / "Tomorrow" / "in 3 days" / "2 days overdue" */
export function dueLabel(d, completed = false) {
  if (!d) return 'No deadline';
  const date = new Date(d);
  const now = new Date();
  if (!completed && date < now) {
    const h = differenceInHours(now, date);
    return h < 24 ? `Overdue by ${Math.max(1, h)}h` : `Overdue by ${Math.round(h / 24)}d`;
  }
  if (isToday(date)) return `Today, ${fmtTime(date)}`;
  if (isTomorrow(date)) return `Tomorrow, ${fmtTime(date)}`;
  if (isYesterday(date)) return `Yesterday, ${fmtTime(date)}`;
  return format(date, 'EEE, MMM d · h:mm a');
}

/** For <input type="datetime-local"> — local time without timezone. */
export function toLocalInput(d) {
  if (!d) return '';
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function fmtBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const capitalize = (s = '') => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};
