import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, ListTodo, AlertTriangle, CheckCircle2, Clock3, Filter, X } from 'lucide-react';
import { taskApi } from '../api';
import useAsync from '../hooks/useAsync';
import useDebounce from '../hooks/useDebounce';
import Button from '../components/ui/Button';
import { PageHeader, Pagination, SearchInput, StatCard, Tabs } from '../components/ui/Display';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import TaskForm from '../components/tasks/TaskForm';
import TaskItem from '../components/tasks/TaskItem';

const VIEWS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
];

const SORTS = [
  { value: 'smart', label: 'Smart priority' },
  { value: 'dueDate', label: 'Deadline (soonest)' },
  { value: 'priority', label: 'Priority' },
  { value: '-createdAt', label: 'Newest' },
  { value: 'title', label: 'Title A–Z' },
];

function viewParams(view) {
  switch (view) {
    case 'pending': return { status: 'pending' };
    case 'upcoming': return { due: 'upcoming', status: 'pending' };
    case 'overdue': return { due: 'overdue' };
    case 'completed': return { status: 'completed' };
    default: return {};
  }
}

export default function Tasks() {
  const [view, setView] = useState('pending');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ priority: '', subject: '', type: '' });
  const [sort, setSort] = useState('smart');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounce(search);

  const params = { ...viewParams(view), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), search: q || undefined, sort, page, limit: 15 };
  const list = useAsync(() => taskApi.list(params), [view, q, filters.priority, filters.subject, filters.type, sort, page]);
  const stats = useAsync(() => taskApi.stats(), []);
  const subjects = useAsync(() => taskApi.subjects(), []);

  const refresh = () => {
    list.reload({ silent: true });
    stats.reload({ silent: true });
    subjects.reload({ silent: true });
  };

  const changeFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const toggle = async (task) => {
    // Optimistic update — revert on failure.
    list.setData((d) => ({ ...d, items: d.items.map((t) => (t._id === task._id ? { ...t, status: t.status === 'completed' ? 'todo' : 'completed' } : t)) }));
    try {
      const updated = await taskApi.toggle(task._id);
      if (updated.status === 'completed') toast.success('Nice work! Task completed 🎉');
      refresh();
    } catch (err) {
      toast.error(err.message);
      list.reload({ silent: true });
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await taskApi.remove(deleting._id);
      toast.success('Task deleted');
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const s = stats.data;
  const hasFilters = Object.values(filters).some(Boolean) || q;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Tasks & assignments"
        description="Track everything due this semester. Smart priority ranks work by urgency and importance."
        actions={<Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>New task</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending" value={s?.pending ?? '–'} icon={ListTodo} tone="brand" />
        <StatCard label="Due this week" value={s?.dueThisWeek ?? '–'} icon={Clock3} tone="amber" />
        <StatCard label="Overdue" value={s?.overdue ?? '–'} icon={AlertTriangle} tone="red" />
        <StatCard label="Completion" value={s ? `${s.completionRate}%` : '–'} icon={CheckCircle2} tone="green" />
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs tabs={VIEWS} value={view} onChange={(v) => { setView(v); setPage(1); }} className="overflow-x-auto" />
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tasks…" className="lg:w-72" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-ink-400" />
            <select className="select h-9 w-auto py-1 text-xs" value={filters.priority} onChange={(e) => changeFilter('priority', e.target.value)} aria-label="Priority filter">
              <option value="">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="select h-9 w-auto py-1 text-xs" value={filters.type} onChange={(e) => changeFilter('type', e.target.value)} aria-label="Type filter">
              <option value="">Tasks & assignments</option>
              <option value="assignment">Assignments only</option>
              <option value="task">Tasks only</option>
            </select>
            <select className="select h-9 w-auto py-1 text-xs" value={filters.subject} onChange={(e) => changeFilter('subject', e.target.value)} aria-label="Subject filter">
              <option value="">All subjects</option>
              {(subjects.data || []).map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            {hasFilters && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFilters({ priority: '', subject: '', type: '' }); setSearch(''); }}>
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="muted text-xs">Sort</span>
              <select className="select h-9 w-auto py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort tasks">
                {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="p-2">
          {list.loading && !list.data && <SkeletonList rows={6} className="p-3" />}
          {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
          {list.data && list.data.items.length === 0 && (
            <EmptyState
              icon={ListTodo}
              title={hasFilters ? 'No tasks match your filters' : 'Nothing here yet'}
              description={hasFilters ? 'Try clearing filters or searching for something else.' : 'Create your first task to start tracking deadlines.'}
              action={!hasFilters && <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>New task</Button>}
            />
          )}
          {list.data?.items.length > 0 && (
            <div className="divide-y divide-ink-100 dark:divide-ink-800/70">
              {list.data.items.map((t) => (
                <TaskItem key={t._id} task={t} onToggle={toggle} onEdit={(x) => { setEditing(x); setFormOpen(true); }} onDelete={setDeleting} />
              ))}
            </div>
          )}
          <div className="px-3 pb-2">
            <Pagination pagination={list.data?.pagination} onChange={setPage} />
          </div>
        </div>
      </div>

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} task={editing} subjects={subjects.data || []} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete task?"
        message={`"${deleting?.title}" will be permanently deleted.`}
      />
    </div>
  );
}
