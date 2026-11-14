import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Users, UserCheck, CheckSquare, FolderOpen, PartyPopper, MessagesSquare, Megaphone, HardDrive, ArrowRight } from 'lucide-react';
import { adminApi } from '../../api';
import useAsync from '../../hooks/useAsync';
import { PageHeader, ProgressBar, StatCard } from '../../components/ui/Display';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { ChartCard, ChartTooltip, axisProps, useChartColors } from '../../components/charts/ChartKit';
import { fmtBytes, fmtDate } from '../../utils/format';

export default function AdminOverview() {
  const c = useChartColors();
  const { data, loading, error, reload } = useAsync(() => adminApi.stats(), []);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-1/3" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const { users, tasks, resources, events, charts } = data;
  const maxDept = Math.max(1, ...charts.byDepartment.map((d) => d.count));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Platform overview" description="Usage, engagement and content across CampusConnect." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Students" value={users.students} icon={Users} tone="brand" hint={`+${users.newThisWeek} this week · ${users.admins} admin${users.admins === 1 ? '' : 's'}`} />
        <StatCard label="Verified accounts" value={users.verified} icon={UserCheck} tone="green" hint={`${users.suspended} suspended`} />
        <StatCard label="Task completion" value={`${tasks.completionRate}%`} icon={CheckSquare} tone="violet" footer={<ProgressBar value={tasks.completionRate} />} />
        <StatCard label="Study groups" value={data.groups} icon={MessagesSquare} tone="sky" hint={`${data.messages} messages sent`} />
        <StatCard label="Resources" value={resources.total} icon={FolderOpen} tone="amber" hint={`${resources.downloads} downloads`} />
        <StatCard label="Storage used" value={fmtBytes(resources.storageBytes)} icon={HardDrive} tone="gray" />
        <StatCard label="Events" value={events.total} icon={PartyPopper} tone="pink" hint={`${events.upcoming} upcoming · ${events.registrations} registrations`} />
        <StatCard label="Announcements" value={data.announcements} icon={Megaphone} tone="red" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="New registrations" subtitle="Accounts created per month">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={charts.userGrowth} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="month" {...axisProps(c)} />
                <YAxis allowDecimals={false} {...axisProps(c)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.5 }} />
                <Bar dataKey="users" name="New users" fill={c.brand} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Platform activity" subtitle="Tracked actions per day · last 14 days">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={charts.activityTrend} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="adminAct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.brand} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={c.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="label" interval={2} {...axisProps(c)} />
                <YAxis allowDecimals={false} {...axisProps(c)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="count" name="Actions" stroke={c.brand} strokeWidth={2} fill="url(#adminAct)" activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Students by department">
          <div className="space-y-3">
            {charts.byDepartment.length === 0 && <p className="muted text-sm">No students yet.</p>}
            {charts.byDepartment.map((d) => (
              <div key={d.department}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{d.department}</span>
                  <span className="font-mono text-ink-500">{d.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                  <div className="h-full rounded-full" style={{ width: `${(d.count / maxDept) * 100}%`, background: c.brand }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Resources by subject" subtitle="Number of uploads per subject">
          {charts.resourcesBySubject.length === 0 ? (
            <p className="muted py-12 text-center text-sm">No uploads yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={charts.resourcesBySubject} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="subject" width={120} {...axisProps(c)} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.5 }} />
                  <Bar dataKey="count" name="Uploads" fill={c.green} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Most popular events" action={<Link to="/events" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">Manage <ArrowRight className="h-3 w-3" /></Link>}>
          <div className="space-y-3">
            {charts.topEvents.length === 0 && <p className="muted text-sm">No events yet.</p>}
            {charts.topEvents.map((e) => (
              <Link key={e._id} to={`/events/${e._id}`} className="block rounded-xl p-2 hover:bg-ink-50 dark:hover:bg-ink-850">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{e.title}</p>
                  <span className="font-mono text-xs text-ink-500">{e.registrationsCount}{e.capacity ? `/${e.capacity}` : ''}</span>
                </div>
                <p className="muted text-xs">{fmtDate(e.startDate)}</p>
                {e.capacity > 0 && <ProgressBar className="mt-1.5 h-1.5" value={(e.registrationsCount / e.capacity) * 100} />}
              </Link>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
