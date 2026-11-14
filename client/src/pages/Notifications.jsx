import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Bell, CheckCheck, Trash2, Eraser } from 'lucide-react';
import { notificationApi } from '../api';
import useAsync from '../hooks/useAsync';
import { useSocket } from '../context/SocketContext';
import Button from '../components/ui/Button';
import { PageHeader, Pagination, Tabs } from '../components/ui/Display';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/Feedback';
import { NotificationIcon } from '../components/notifications/NotificationIcon';
import { fmtDateTime, timeAgo } from '../utils/format';

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'announcement', label: 'Announcements' },
  { value: 'deadline', label: 'Deadlines' },
  { value: 'reminder', label: 'Reminders' },
  { value: 'group_invite', label: 'Group invites' },
  { value: 'group', label: 'Groups' },
  { value: 'event', label: 'Events' },
  { value: 'system', label: 'System' },
];

export default function Notifications() {
  const navigate = useNavigate();
  const { setUnread, onNotification } = useSocket();
  const [filter, setFilter] = useState('all');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const list = useAsync(() => notificationApi.list({ unread: filter === 'unread' ? 'true' : undefined, type: type || undefined, page, limit: 15 }), [filter, type, page]);

  useEffect(() => {
    if (list.data) setUnread(list.data.unread);
  }, [list.data, setUnread]);

  // New notifications appear instantly at the top.
  useEffect(() => onNotification(() => page === 1 && list.reload({ silent: true })), [onNotification, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (n) => {
    if (!n.isRead) {
      await notificationApi.markRead(n._id).catch(() => {});
      list.setData((d) => ({ ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)) }));
    }
    if (n.link) navigate(n.link);
  };

  const remove = async (n) => {
    try {
      await notificationApi.remove(n._id);
      list.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const markAll = async () => {
    await notificationApi.markAllRead();
    toast.success('All caught up');
    list.reload({ silent: true });
  };

  const clearRead = async () => {
    const { deleted } = await notificationApi.clearRead();
    toast.success(`${deleted} notification${deleted === 1 ? '' : 's'} cleared`);
    setPage(1);
    list.reload({ silent: true });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Announcements, deadlines, reminders and invitations — delivered in real time."
        actions={
          <>
            <Button variant="secondary" size="sm" icon={Eraser} onClick={clearRead}>Clear read</Button>
            <Button size="sm" icon={CheckCheck} onClick={markAll} disabled={!list.data?.unread}>Mark all read</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onChange={(v) => { setFilter(v); setPage(1); }} tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread', count: list.data?.unread }]} />
        <select className="select h-9 w-auto py-1 text-xs" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Type">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div className="card p-2">
        {list.loading && !list.data && <SkeletonList rows={6} className="p-3" />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data?.items.length === 0 && <EmptyState icon={Bell} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="We'll let you know when something needs your attention." />}
        {list.data?.items.map((n) => (
          <div key={n._id} className={clsx('group flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-ink-50 dark:hover:bg-ink-850', !n.isRead && 'bg-brand-50/50 dark:bg-brand-500/5')}>
            <button type="button" onClick={() => open(n)} className="flex min-w-0 flex-1 gap-3 text-left">
              <NotificationIcon type={n.type} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{n.title}</span>
                {n.message && <span className="muted block text-xs">{n.message}</span>}
                <span className="mt-1 block text-[11px] text-ink-400" title={fmtDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</span>
              </span>
            </button>
            {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
            <button type="button" onClick={() => remove(n)} className="btn btn-ghost btn-icon opacity-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete notification">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="px-3"><Pagination pagination={list.data?.pagination} onChange={setPage} /></div>
      </div>
    </div>
  );
}
