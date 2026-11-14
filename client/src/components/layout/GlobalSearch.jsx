import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderOpen, Users, PartyPopper, Megaphone, CheckSquare, CornerDownLeft } from 'lucide-react';
import { insightApi } from '../../api';
import useDebounce from '../../hooks/useDebounce';
import Spinner from '../ui/Spinner';
import { fmtDate } from '../../utils/format';

const SECTIONS = [
  { key: 'tasks', label: 'Tasks', icon: CheckSquare, to: () => '/tasks', sub: (t) => `${t.subject} · ${t.status.replace('_', ' ')}` },
  { key: 'resources', label: 'Resources', icon: FolderOpen, to: (r) => `/resources?open=${r._id}`, sub: (r) => `${r.subject} · Sem ${r.semester}` },
  { key: 'groups', label: 'Study groups', icon: Users, to: (g) => `/groups/${g._id}`, sub: (g) => `${g.subject} · ${g.memberCount} members` },
  { key: 'events', label: 'Events', icon: PartyPopper, to: (e) => `/events/${e._id}`, sub: (e) => `${fmtDate(e.startDate)} · ${e.venue}` },
  { key: 'announcements', label: 'Announcements', icon: Megaphone, to: (a) => `/announcements?highlight=${a._id}`, sub: (a) => `${a.category} · ${fmtDate(a.createdAt)}` },
];

/** Topbar search: quick results dropdown; Enter opens the full results page. Ctrl/⌘+K focuses it. */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const debounced = useDebounce(q.trim(), 300);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    insightApi
      .search(debounced, 4)
      .then((d) => !cancelled && setResults(d))
      .catch(() => !cancelled && setResults(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    const onClick = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (to) => {
    setOpen(false);
    setQ('');
    navigate(to);
  };

  const submit = (e) => {
    e.preventDefault();
    if (q.trim().length >= 2) go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <form onSubmit={submit}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search resources, groups, events…"
          className="input h-10 rounded-xl border-transparent bg-ink-100 pl-9 pr-16 dark:border-transparent dark:bg-ink-850"
          aria-label="Global search"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-ink-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-400 sm:block dark:border-ink-700 dark:bg-ink-800">
          Ctrl K
        </kbd>
      </form>

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-ink-200 bg-white p-2 shadow-pop animate-fade-in dark:border-ink-700 dark:bg-ink-900">
          {loading && !results && (
            <div className="flex items-center gap-2 p-4 text-sm text-ink-400">
              <Spinner className="h-4 w-4" /> Searching…
            </div>
          )}
          {results && results.total === 0 && <p className="p-4 text-sm text-ink-500">No results for “{debounced}”.</p>}
          {results &&
            SECTIONS.filter((s) => results[s.key]?.length).map((s) => (
              <div key={s.key} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-400">{s.label}</p>
                {results[s.key].map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => go(s.to(item))}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-ink-50 dark:hover:bg-ink-800"
                  >
                    <s.icon className="h-4 w-4 shrink-0 text-ink-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.title || item.name}</span>
                      <span className="muted block truncate text-xs capitalize">{s.sub(item)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
          {results && results.total > 0 && (
            <button type="button" onClick={submit} className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
              See all results for “{debounced}” <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
