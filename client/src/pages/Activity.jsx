import { useState } from 'react';
import { History, CheckSquare, FolderOpen, Users, PartyPopper, Megaphone, LogIn, User } from 'lucide-react';
import clsx from 'clsx';
import { insightApi } from '../api';
import useAsync from '../hooks/useAsync';
import { PageHeader, Pagination } from '../components/ui/Display';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/Feedback';
import { TONES } from '../utils/constants';
import { fmtDate, fmtTime } from '../utils/format';

const ENTITY = {
  task: { icon: CheckSquare, tone: 'brand', label: 'Tasks' },
  resource: { icon: FolderOpen, tone: 'amber', label: 'Resources' },
  group: { icon: Users, tone: 'violet', label: 'Groups' },
  event: { icon: PartyPopper, tone: 'pink', label: 'Events' },
  announcement: { icon: Megaphone, tone: 'sky', label: 'Announcements' },
  auth: { icon: LogIn, tone: 'gray', label: 'Account' },
  user: { icon: User, tone: 'green', label: 'Profile' },
};

export default function Activity() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => insightApi.activity({ entityType: entity || undefined, page, limit: 25 }), [entity, page]);

  // Group entries by calendar day for a timeline layout.
  const byDay = (data?.items || []).reduce((acc, a) => {
    const key = fmtDate(a.createdAt, 'EEEE, MMMM d, yyyy');
    (acc[key] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Insights"
        title="Activity history"
        description="A timeline of everything you've done on CampusConnect."
        actions={
          <select className="select h-9 w-auto py-1 text-xs" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Filter">
            <option value="">All activity</option>
            {Object.entries(ENTITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        }
      />
      <div className="card p-5">
        {loading && !data && <SkeletonList rows={8} />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data?.items.length === 0 && <EmptyState icon={History} title="No activity yet" description="Your actions will appear here as you use the platform." />}
        {Object.entries(byDay).map(([day, entries]) => (
          <div key={day} className="mb-6 last:mb-0">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">{day}</p>
            <ol className="relative space-y-4 border-l border-ink-200 pl-6 dark:border-ink-800">
              {entries.map((a) => {
                const e = ENTITY[a.entityType] || ENTITY.user;
                return (
                  <li key={a._id} className="relative">
                    <span className={clsx('absolute -left-[37px] grid h-6 w-6 place-items-center rounded-full ring-4 ring-white dark:ring-ink-900', TONES[e.tone])}>
                      <e.icon className="h-3 w-3" />
                    </span>
                    <p className="text-sm font-medium">{a.description || a.action}</p>
                    <p className="muted text-xs">{fmtTime(a.createdAt)} · {e.label}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        <Pagination pagination={data?.pagination} onChange={setPage} />
      </div>
    </div>
  );
}
