import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, FolderOpen, Users, PartyPopper, Megaphone, CheckSquare } from 'lucide-react';
import { insightApi } from '../api';
import useAsync from '../hooks/useAsync';
import useDebounce from '../hooks/useDebounce';
import { Badge, PageHeader } from '../components/ui/Display';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/Feedback';
import { capitalize, dueLabel, fmtDate } from '../utils/format';

const GROUPS = [
  { key: 'tasks', title: 'Your tasks', icon: CheckSquare, to: () => '/tasks', main: (t) => t.title, sub: (t) => `${t.subject} · ${dueLabel(t.dueDate, t.status === 'completed')}`, badge: (t) => capitalize(t.status) },
  { key: 'resources', title: 'Resources', icon: FolderOpen, to: (r) => `/resources?open=${r._id}`, main: (r) => r.title, sub: (r) => `${r.subject} · Semester ${r.semester}`, badge: (r) => capitalize(r.type) },
  { key: 'groups', title: 'Study groups', icon: Users, to: (g) => `/groups/${g._id}`, main: (g) => g.name, sub: (g) => `${g.subject} · ${g.memberCount} members`, badge: (g) => (g.isPrivate ? 'Private' : 'Open') },
  { key: 'events', title: 'Events', icon: PartyPopper, to: (e) => `/events/${e._id}`, main: (e) => e.title, sub: (e) => `${fmtDate(e.startDate)} · ${e.venue}`, badge: (e) => capitalize(e.category) },
  { key: 'announcements', title: 'Announcements', icon: Megaphone, to: (a) => `/announcements?highlight=${a._id}`, main: (a) => a.title, sub: (a) => fmtDate(a.createdAt), badge: (a) => capitalize(a.category) },
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const debounced = useDebounce(q.trim(), 300);

  useEffect(() => {
    setParams(debounced ? { q: debounced } : {}, { replace: true });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, error, reload } = useAsync(() => (debounced.length >= 2 ? insightApi.search(debounced, 10) : Promise.resolve(null)), [debounced]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Search" description="Find resources, study groups, events, announcements and your own tasks." />
      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are you looking for?" className="input h-14 rounded-2xl pl-12 text-base" />
      </div>

      {debounced.length < 2 && <div className="card"><EmptyState icon={SearchIcon} title="Start typing to search" description="Search runs across everything you have access to." /></div>}
      {loading && debounced.length >= 2 && <div className="card p-5"><SkeletonList rows={5} /></div>}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && !loading && data.total === 0 && <div className="card"><EmptyState icon={SearchIcon} title={`No results for “${data.query}”`} description="Try different keywords or check the spelling." /></div>}
      {data && !loading && data.total > 0 && (
        <div className="space-y-5">
          <p className="muted text-sm">{data.total} result{data.total === 1 ? '' : 's'} for “{data.query}”</p>
          {GROUPS.filter((g) => data[g.key]?.length).map((g) => (
            <section key={g.key} className="card">
              <h2 className="section-title flex items-center gap-2 border-b border-ink-100 px-5 py-3 dark:border-ink-800">
                <g.icon className="h-4 w-4 text-ink-400" /> {g.title} <span className="muted text-xs font-normal">({data[g.key].length})</span>
              </h2>
              <div className="p-2">
                {data[g.key].map((item) => (
                  <Link key={item._id} to={g.to(item)} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-850">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{g.main(item)}</span>
                      <span className="muted block truncate text-xs">{g.sub(item)}</span>
                    </span>
                    <Badge tone="gray">{g.badge(item)}</Badge>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
