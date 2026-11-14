import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TONES } from '../../utils/constants';
import { initials } from '../../utils/format';
import { API_BASE } from '../../api';

export function Badge({ tone = 'gray', className, children, dot }) {
  return (
    <span className={clsx('chip', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const AVATAR_COLORS = [
  'from-brand-500 to-violet-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-sky-500 to-cyan-500',
  'from-pink-500 to-rose-500',
  'from-indigo-500 to-blue-500',
];

export function Avatar({ user, size = 'md', className }) {
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' };
  const name = user?.name || '?';
  const color = AVATAR_COLORS[(name.charCodeAt(0) + name.length) % AVATAR_COLORS.length];
  if (user?.avatar) {
    return (
      <img
        src={user.avatar.startsWith('http') ? user.avatar : `${API_BASE}${user.avatar}`}
        alt={name}
        className={clsx('shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-ink-900', sizes[size], className)}
      />
    );
  }
  return (
    <span
      className={clsx(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white dark:ring-ink-900',
        color,
        sizes[size],
        className
      )}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, total }) {
  const shown = users.slice(0, max);
  const extra = (total ?? users.length) - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((u, i) => (
        <Avatar key={u?._id || i} user={u} size="xs" />
      ))}
      {extra > 0 && (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-100 text-[10px] font-bold text-ink-600 ring-2 ring-white dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-900">
          +{extra}
        </span>
      )}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {description && <p className="muted mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, footer }) {
  return (
    <div className="card card-pad flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="muted text-xs font-semibold uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 font-mono text-[26px] font-medium leading-none text-ink-900 dark:text-white">{value}</p>
        </div>
        {Icon && (
          <span className={clsx('grid h-10 w-10 place-items-center rounded-xl', TONES[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {hint && <p className="muted text-xs">{hint}</p>}
      {footer}
    </div>
  );
}

export function ProgressBar({ value = 0, tone = 'brand', className }) {
  const bars = { brand: 'bg-brand-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500' };
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', className)}>
      <div className={clsx('h-full rounded-full transition-all duration-500', bars[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      <p className="muted text-xs">
        Showing <span className="font-semibold text-ink-700 dark:text-ink-200">{from}–{to}</span> of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <span className="px-2 text-xs font-semibold">
          {page} / {pages}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx('inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-850', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === t.value
              ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white'
              : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100'
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-ink-400">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={clsx('relative', className)}>
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}
