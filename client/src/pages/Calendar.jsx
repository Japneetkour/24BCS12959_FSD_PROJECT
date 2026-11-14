import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, CheckSquare, ClipboardList, PartyPopper } from 'lucide-react';
import { insightApi } from '../api';
import useAsync from '../hooks/useAsync';
import { Badge, PageHeader } from '../components/ui/Display';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import Spinner from '../components/ui/Spinner';
import { capitalize, fmtTime } from '../utils/format';

const KIND = {
  task: { label: 'Task', icon: CheckSquare, chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200', dot: 'bg-sky-500' },
  assignment: { label: 'Assignment', icon: ClipboardList, chip: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200', dot: 'bg-violet-500' },
  event: { label: 'Event', icon: PartyPopper, chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200', dot: 'bg-amber-500' },
};

/** True if the item touches the given day (events can span several days). */
const onDay = (item, day) => {
  const s = new Date(item.start);
  const e = new Date(item.end || item.start);
  const dayStart = new Date(day).setHours(0, 0, 0, 0);
  const dayEnd = new Date(day).setHours(23, 59, 59, 999);
  return s <= dayEnd && e >= dayStart;
};

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [kinds, setKinds] = useState({ task: true, assignment: true, event: true });

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = useMemo(() => {
    const out = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) out.push(d);
    return out;
  }, [gridStart.getTime(), gridEnd.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, error, reload } = useAsync(
    () => insightApi.calendar(gridStart.toISOString(), new Date(gridEnd.getTime() + 86399999).toISOString()),
    [month.getTime()]
  );

  const items = (data || []).filter((i) => kinds[i.kind]);
  const selectedItems = items.filter((i) => onDay(i, selected));

  const go = (n) => setMonth((m) => addMonths(m, n));

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Calendar"
        description="Assignments, tasks and campus events in one view."
        actions={
          <div className="flex items-center gap-2">
            {Object.entries(KIND).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}
                className={clsx('chip border px-3 py-1.5 transition', kinds[k] ? 'border-transparent ' + v.chip : 'border-ink-200 text-ink-400 dark:border-ink-700')}
                aria-pressed={kinds[k]}
              >
                <span className={clsx('h-2 w-2 rounded-full', kinds[k] ? v.dot : 'bg-ink-300')} /> {v.label}s
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{format(month, 'MMMM yyyy')}</h2>
              {loading && <Spinner className="h-4 w-4 text-ink-400" />}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()); }}>Today</button>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => go(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-ink-100 text-center text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:border-ink-800">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const dayItems = items.filter((i) => onDay(i, day));
                  const isSel = isSameDay(day, selected);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelected(day)}
                      className={clsx(
                        'flex min-h-[64px] flex-col gap-1 border-b border-r border-ink-100 p-1.5 text-left transition sm:min-h-[104px] dark:border-ink-800',
                        !isSameMonth(day, month) && 'bg-ink-50/60 text-ink-400 dark:bg-ink-950/40',
                        isSel ? 'bg-brand-50/70 dark:bg-brand-500/10' : 'hover:bg-ink-50 dark:hover:bg-ink-850'
                      )}
                    >
                      <span className={clsx('grid h-6 w-6 place-items-center rounded-full font-mono text-xs', isToday(day) && 'bg-brand-600 font-bold text-white')}>
                        {format(day, 'd')}
                      </span>
                      <div className="hidden space-y-0.5 sm:block">
                        {dayItems.slice(0, 3).map((i) => (
                          <span key={i.kind + i.id} className={clsx('block truncate rounded px-1.5 py-0.5 text-[11px] font-medium', KIND[i.kind].chip, i.status === 'completed' && 'line-through opacity-60')}>
                            {i.title}
                          </span>
                        ))}
                        {dayItems.length > 3 && <span className="block px-1.5 text-[11px] font-semibold text-ink-400">+{dayItems.length - 3} more</span>}
                      </div>
                      <div className="flex flex-wrap gap-0.5 sm:hidden">
                        {dayItems.slice(0, 4).map((i) => <span key={i.kind + i.id} className={clsx('h-1.5 w-1.5 rounded-full', KIND[i.kind].dot)} />)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="card card-pad h-fit">
          <h3 className="section-title">{format(selected, 'EEEE, MMMM d')}</h3>
          <p className="muted text-xs">{selectedItems.length} item{selectedItems.length === 1 ? '' : 's'}</p>
          <div className="mt-4 space-y-2">
            {selectedItems.length === 0 && <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Enjoy a free day — or plan ahead." className="py-6" />}
            {selectedItems.map((i) => {
              const k = KIND[i.kind];
              return (
                <Link key={i.kind + i.id} to={i.link} className="flex gap-3 rounded-xl border border-ink-200/70 p-3 transition hover:border-brand-300 dark:border-ink-800 dark:hover:border-brand-500/40">
                  <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', k.chip)}>
                    <k.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={clsx('block text-sm font-semibold', i.status === 'completed' && 'line-through opacity-60')}>{i.title}</span>
                    <span className="muted block text-xs">
                      {i.kind === 'event' ? (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {i.venue} · {fmtTime(i.start)}</span>
                      ) : (
                        `${i.subject} · due ${fmtTime(i.start)}`
                      )}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      <Badge tone="gray">{k.label}</Badge>
                      {i.priority && <Badge tone={{ high: 'red', medium: 'amber', low: 'green' }[i.priority]}>{capitalize(i.priority)}</Badge>}
                      {i.isRegistered && <Badge tone="green">Registered</Badge>}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
