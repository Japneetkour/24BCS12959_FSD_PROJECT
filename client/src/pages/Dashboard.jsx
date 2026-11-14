import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Plus, ListTodo, AlertTriangle, CheckCircle2, Users, ArrowRight, CalendarDays, MapPin, Megaphone, Sparkles,
  FolderUp, PartyPopper, Pin, UserPlus, ClipboardList,
} from 'lucide-react';
import { insightApi, taskApi } from '../api';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Badge, ProgressBar, StatCard } from '../components/ui/Display';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import TaskItem from '../components/tasks/TaskItem';
import TaskForm from '../components/tasks/TaskForm';
import { ChartTooltip, axisProps, useChartColors } from '../components/charts/ChartKit';
import { ANNOUNCEMENT_TONE, EVENT_TONE } from '../utils/constants';
import { capitalize, fmtDate, fmtTime, greeting, timeAgo, dueLabel } from '../utils/format';

function Panel({ title, to, linkLabel = 'View all', children, icon: Icon }) {
  return (
    <section className="card flex flex-col">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className="section-title flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-ink-400" />} {title}
        </h2>
        {to && (
          <Link to={to} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
            {linkLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex-1 px-2 pb-3">{children}</div>
    </section>
  );
}

const SHORTCUTS = [
  { to: '/tasks', label: 'Add task', icon: Plus, action: 'task' },
  { to: '/resources?upload=1', label: 'Upload notes', icon: FolderUp },
  { to: '/groups', label: 'Find a group', icon: Users },
  { to: '/events', label: 'Browse events', icon: PartyPopper },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { onNotification } = useSocket();
  const colors = useChartColors();
  const [formOpen, setFormOpen] = useState(false);
  const { data, loading, error, reload, setData } = useAsync(() => insightApi.dashboard(), []);

  // Live refresh when a real-time notification arrives (announcement, invite, deadline…).
  useEffect(() => onNotification(() => reload({ silent: true })), [onNotification, reload]);

  const toggle = async (task) => {
    // Optimistically remove it from the lists, then re-sync with the server.
    setData((d) => ({
      ...d,
      focus: d.focus.filter((t) => t._id !== task._id),
      upcomingDeadlines: d.upcomingDeadlines.filter((t) => t._id !== task._id),
    }));
    try {
      const updated = await taskApi.toggle(task._id);
      toast.success(updated.status === 'completed' ? 'Task completed 🎉' : 'Task reopened');
    } catch (err) {
      toast.error(err.message);
    } finally {
      reload({ silent: true });
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;
  const s = data?.stats;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-violet-700 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-white/70">{fmtDate(new Date(), 'EEEE, MMMM d')}</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
              {greeting()}, {user.name.split(' ')[0]} 👋
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              {s
                ? s.overdue > 0
                  ? `You have ${s.overdue} overdue task${s.overdue > 1 ? 's' : ''} and ${s.dueThisWeek} due this week. Let's catch up.`
                  : s.dueThisWeek > 0
                    ? `${s.dueThisWeek} task${s.dueThisWeek > 1 ? 's' : ''} due this week. You're on track!`
                    : "Nothing urgent this week — a great time to get ahead."
                : 'Loading your day…'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SHORTCUTS.map((sc) =>
              sc.action === 'task' ? (
                <button key={sc.label} type="button" onClick={() => setFormOpen(true)} className="btn bg-white text-brand-700 hover:bg-white/90">
                  <sc.icon className="h-4 w-4" /> {sc.label}
                </button>
              ) : (
                <Link key={sc.label} to={sc.to} className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20">
                  <sc.icon className="h-4 w-4" /> {sc.label}
                </Link>
              )
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
        ) : (
          <>
            <StatCard label="Pending tasks" value={s.pending} icon={ListTodo} tone="brand" hint={`${s.pendingAssignments} assignment${s.pendingAssignments === 1 ? '' : 's'} pending`} />
            <StatCard label="Overdue" value={s.overdue} icon={AlertTriangle} tone="red" hint={s.overdue ? 'Needs attention' : 'All caught up'} />
            <StatCard
              label="Completion rate"
              value={`${s.completionRate}%`}
              icon={CheckCircle2}
              tone="green"
              footer={<ProgressBar value={s.completionRate} tone="green" />}
            />
            <StatCard label="Study groups" value={s.groups} icon={Users} tone="violet" hint={s.pendingInvites ? `${s.pendingInvites} pending invite${s.pendingInvites > 1 ? 's' : ''}` : 'Collaborate with peers'} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Focus + deadlines */}
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Smart focus" icon={Sparkles} to="/tasks" linkLabel="All tasks">
            {!data ? (
              <Skeleton className="m-3 h-24" />
            ) : data.focus.length === 0 ? (
              <EmptyState icon={Sparkles} title="Nothing to focus on" description="Add tasks with deadlines and we'll rank them for you." />
            ) : (
              <div className="grid gap-3 p-3 md:grid-cols-3">
                {data.focus.map((t, i) => (
                  <div key={t._id} className="rounded-2xl border border-ink-200/70 p-4 dark:border-ink-800">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-ink-400">#{i + 1}</span>
                      <Badge tone={{ 'Do now': 'red', 'Do next': 'amber', Plan: 'brand', Later: 'gray' }[t.smart.label]}>{t.smart.label}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold">{t.title}</p>
                    <p className="muted mt-1 text-xs">{t.subject}</p>
                    <p className="mt-3 text-xs font-medium text-ink-600 dark:text-ink-300">{t.smart.reason}</p>
                    <button type="button" onClick={() => toggle(t)} className="btn btn-secondary btn-sm mt-3 w-full">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark done
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Upcoming deadlines" icon={CalendarDays} to="/calendar" linkLabel="Calendar">
              {!data ? (
                <Skeleton className="m-3 h-40" />
              ) : data.upcomingDeadlines.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No upcoming deadlines" />
              ) : (
                data.upcomingDeadlines.map((t) => <TaskItem key={t._id} task={t} onToggle={toggle} compact />)
              )}
            </Panel>
            <Panel title="Pending assignments" icon={ClipboardList} to="/tasks">
              {!data ? (
                <Skeleton className="m-3 h-40" />
              ) : data.pendingAssignments.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No pending assignments" description="Enjoy the free time!" />
              ) : (
                data.pendingAssignments.map((t) => (
                  <div key={t._id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-850">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.title}</p>
                      <p className={`text-xs ${t.isOverdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'muted'}`}>{t.subject} · {dueLabel(t.dueDate)}</p>
                    </div>
                    <Badge tone={{ high: 'red', medium: 'amber', low: 'green' }[t.priority]} dot>{capitalize(t.priority)}</Badge>
                  </div>
                ))
              )}
            </Panel>
          </div>

          {/* Weekly chart */}
          <section className="card card-pad">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="section-title">Tasks completed this week</h2>
                <p className="muted text-xs">
                  {data ? `${data.weeklyCompletion.reduce((a, b) => a + b.completed, 0)} completed in the last 7 days` : '…'}
                </p>
              </div>
              <Link to="/analytics" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">Full analytics</Link>
            </div>
            <div className="h-48">
              {data && (
                <ResponsiveContainer>
                  <BarChart data={data.weeklyCompletion} margin={{ left: -20, right: 4, top: 4 }}>
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="label" {...axisProps(colors)} />
                    <YAxis allowDecimals={false} {...axisProps(colors)} />
                    <Tooltip cursor={{ fill: colors.grid, opacity: 0.5 }} content={<ChartTooltip />} />
                    <Bar dataKey="completed" name="Completed" fill={colors.brand} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Panel title="Upcoming events" icon={PartyPopper} to="/events">
            {!data ? (
              <Skeleton className="m-3 h-48" />
            ) : data.upcomingEvents.length === 0 ? (
              <EmptyState icon={PartyPopper} title="No upcoming events" />
            ) : (
              data.upcomingEvents.map((e) => (
                <Link key={e._id} to={`/events/${e._id}`} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-850">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-100 text-center dark:bg-ink-800">
                    <span>
                      <span className="block text-[10px] font-bold uppercase text-brand-600 dark:text-brand-400">{fmtDate(e.startDate, 'MMM')}</span>
                      <span className="block font-mono text-base font-medium leading-none">{fmtDate(e.startDate, 'd')}</span>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="muted flex items-center gap-1 truncate text-xs">
                      <MapPin className="h-3 w-3 shrink-0" /> {e.venue} · {fmtTime(e.startDate)}
                    </p>
                    <div className="mt-1 flex gap-1.5">
                      <Badge tone={EVENT_TONE[e.category]}>{capitalize(e.category)}</Badge>
                      {e.isRegistered && <Badge tone="green">Registered</Badge>}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </Panel>

          <Panel title="Announcements" icon={Megaphone} to="/announcements">
            {!data ? (
              <Skeleton className="m-3 h-48" />
            ) : data.recentAnnouncements.length === 0 ? (
              <EmptyState icon={Megaphone} title="No announcements" />
            ) : (
              data.recentAnnouncements.map((a) => (
                <Link key={a._id} to={`/announcements?highlight=${a._id}`} className="block rounded-xl px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-850">
                  <div className="flex items-center gap-1.5">
                    {a.isPinned && <Pin className="h-3 w-3 text-brand-500" />}
                    <Badge tone={ANNOUNCEMENT_TONE[a.category]}>{capitalize(a.category)}</Badge>
                    {a.priority === 'important' && <Badge tone="red">Important</Badge>}
                    <span className="ml-auto text-[11px] text-ink-400">{timeAgo(a.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm font-semibold">{a.title}</p>
                  <p className="muted line-clamp-2 text-xs">{a.content}</p>
                </Link>
              ))
            )}
          </Panel>

          {s?.pendingInvites > 0 && (
            <Link to="/groups?tab=invites" className="card card-pad flex items-center gap-3 hover:border-brand-300 dark:hover:border-brand-500/50">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                <UserPlus className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">You have {s.pendingInvites} group invitation{s.pendingInvites > 1 ? 's' : ''}</span>
                <span className="muted text-xs">Review and join your peers</span>
              </span>
              <ArrowRight className="h-4 w-4 text-ink-400" />
            </Link>
          )}
        </div>
      </div>

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => reload({ silent: true })} />
    </div>
  );
}
