import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Target, Timer, FolderUp, Download, Users, PartyPopper, MessageSquare, Bookmark } from 'lucide-react';
import { insightApi } from '../api';
import useAsync from '../hooks/useAsync';
import { PageHeader, ProgressBar, StatCard } from '../components/ui/Display';
import { ErrorState, Skeleton } from '../components/ui/Feedback';
import { ChartCard, ChartTooltip, axisProps, useChartColors } from '../components/charts/ChartKit';
import { capitalize } from '../utils/format';

export default function Analytics() {
  const c = useChartColors();
  const { data, loading, error, reload } = useAsync(() => insightApi.analytics(), []);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-1/3" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const { tasks, totals } = data;
  const priorityColor = { high: c.red, medium: c.amber, low: c.green };
  const priorityData = tasks.byPriority.map((p) => ({ ...p, name: capitalize(p.priority), pending: p.total - p.completed }));
  const activeDays = data.activityByDay.filter((d) => d.count > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Your academic analytics" description="How you're tracking on tasks, collaboration and campus life." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Completion rate" value={`${tasks.completionRate}%`} icon={Target} tone="green" footer={<ProgressBar value={tasks.completionRate} tone="green" />} />
        <StatCard label="On-time rate" value={data.onTimeRate === null ? '—' : `${data.onTimeRate}%`} icon={Timer} tone="brand" hint="Completed before the deadline" />
        <StatCard label="Tasks completed" value={tasks.completed} icon={Target} tone="violet" hint={`of ${tasks.total} total · ${tasks.overdue} overdue`} />
        <StatCard label="Active days" value={activeDays} icon={MessageSquare} tone="amber" hint="in the last 30 days" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Tasks created vs completed"
          subtitle="Last 8 weeks"
          legend={[{ label: 'Created', color: c.sky }, { label: 'Completed', color: c.brand }]}
        >
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data.completionTrend} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="week" {...axisProps(c)} />
                <YAxis allowDecimals={false} {...axisProps(c)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
                <Line type="monotone" dataKey="created" name="Created" stroke={c.sky} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke={c.brand} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="By priority" subtitle="Completed out of total">
          <div className="space-y-5 pt-2">
            {priorityData.map((p) => (
              <div key={p.priority}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: priorityColor[p.priority] }} /> {p.name}
                  </span>
                  <span className="font-mono text-xs text-ink-500">{p.completed}/{p.total}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                  <div className="h-full rounded-full" style={{ width: `${p.total ? (p.completed / p.total) * 100 : 0}%`, background: priorityColor[p.priority] }} />
                </div>
              </div>
            ))}
            <p className="muted border-t border-ink-100 pt-4 text-xs dark:border-ink-800">
              {tasks.pending} pending · {tasks.dueThisWeek} due this week
            </p>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Tasks by subject" subtitle="Completed vs pending" legend={[{ label: 'Completed', color: c.brand }, { label: 'Pending', color: c.amber }]}>
          {tasks.bySubject.length === 0 ? (
            <p className="muted py-16 text-center text-sm">No tasks yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={tasks.bySubject.map((s) => ({ ...s, pending: s.total - s.completed }))} layout="vertical" margin={{ left: 10, right: 12 }} barCategoryGap={8}>
                  <CartesianGrid horizontal={false} stroke={c.grid} />
                  <XAxis type="number" allowDecimals={false} {...axisProps(c)} />
                  <YAxis type="category" dataKey="subject" width={130} {...axisProps(c)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.5 }} />
                  <Bar dataKey="completed" name="Completed" stackId="a" fill={c.brand} stroke={c.surface} strokeWidth={2} maxBarSize={22} />
                  <Bar dataKey="pending" name="Pending" stackId="a" fill={c.amber} stroke={c.surface} strokeWidth={2} radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Daily activity" subtitle="Actions on CampusConnect · last 30 days">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={data.activityByDay} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="actFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.brand} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={c.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" interval={6} {...axisProps(c)} />
                <YAxis allowDecimals={false} {...axisProps(c)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="count" name="Actions" stroke={c.brand} strokeWidth={2} fill="url(#actFill)" activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div>
        <h2 className="section-title mb-3">Collaboration & campus life</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Uploads" value={totals.resourcesUploaded} icon={FolderUp} tone="brand" />
          <StatCard label="Downloads received" value={totals.downloadsReceived} icon={Download} tone="green" />
          <StatCard label="Groups" value={totals.groupsJoined} icon={Users} tone="violet" />
          <StatCard label="Events" value={totals.eventsRegistered} icon={PartyPopper} tone="pink" />
          <StatCard label="Messages" value={totals.messagesSent} icon={MessageSquare} tone="sky" />
          <StatCard label="Bookmarks" value={totals.bookmarks} icon={Bookmark} tone="amber" />
        </div>
      </div>
    </div>
  );
}
