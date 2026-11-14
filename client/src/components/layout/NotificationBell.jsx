import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import clsx from 'clsx';
import { notificationApi } from '../../api';
import { useSocket } from '../../context/SocketContext';
import { NotificationIcon } from '../notifications/NotificationIcon';
import { timeAgo } from '../../utils/format';
import Spinner from '../ui/Spinner';

export default function NotificationBell() {
  const navigate = useNavigate();
  const { unread, setUnread, onNotification } = useSocket();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);

  const load = () =>
    notificationApi
      .list({ limit: 8 })
      .then((d) => {
        setItems(d.items);
        setUnread(d.unread);
      })
      .catch(() => setItems([]));

  useEffect(() => {
    if (open) load();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prepend live notifications while the panel is open.
  useEffect(() => onNotification((n) => setItems((list) => (list ? [n, ...list].slice(0, 8) : list))), [onNotification]);

  useEffect(() => {
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) {
      setUnread((c) => Math.max(0, c - 1));
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
      notificationApi.markRead(n._id).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await notificationApi.markAllRead();
    setUnread(0);
    setItems((list) => list?.map((x) => ({ ...x, isRead: true })));
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-ghost btn-icon relative" aria-label={`Notifications (${unread} unread)`}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-ink-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-ink-200 bg-white shadow-pop animate-fade-in dark:border-ink-700 dark:bg-ink-900">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <p className="text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto p-1.5">
            {!items && (
              <div className="grid place-items-center p-6 text-ink-400">
                <Spinner />
              </div>
            )}
            {items?.length === 0 && <p className="p-6 text-center text-sm text-ink-500">You're all caught up 🎉</p>}
            {items?.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() => openItem(n)}
                className={clsx('flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-ink-50 dark:hover:bg-ink-800', !n.isRead && 'bg-brand-50/60 dark:bg-brand-500/5')}
              >
                <NotificationIcon type={n.type} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-snug">{n.title}</span>
                  {n.message && <span className="muted line-clamp-2 block text-xs">{n.message}</span>}
                  <span className="mt-0.5 block text-[11px] text-ink-400">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              </button>
            ))}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-ink-100 px-4 py-2.5 text-center text-xs font-semibold text-brand-600 hover:bg-ink-50 dark:border-ink-800 dark:text-brand-300 dark:hover:bg-ink-800">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
