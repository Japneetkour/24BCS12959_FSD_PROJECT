import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun, LogOut, User as UserIcon, Bell, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import { Avatar } from '../ui/Display';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';

function UserMenu() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-ink-100 dark:hover:bg-ink-800">
        <Avatar user={user} size="sm" />
        <span className="hidden text-left md:block">
          <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-tight">{user.name}</span>
          <span className="block text-[11px] capitalize text-ink-400">{isAdmin ? 'Administrator' : `${user.department}`}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-ink-400 md:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-ink-200 bg-white p-1.5 shadow-pop animate-fade-in dark:border-ink-700 dark:bg-ink-900">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="muted truncate text-xs">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-ink-100 dark:bg-ink-800" />
          <Link to="/profile" onClick={() => setOpen(false)} className="nav-link">
            <UserIcon className="h-4 w-4" /> Profile & settings
          </Link>
          <Link to="/notifications" onClick={() => setOpen(false)} className="nav-link">
            <Bell className="h-4 w-4" /> Notifications
          </Link>
          <button type="button" onClick={handleLogout} className="nav-link w-full text-rose-600 dark:text-rose-400">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { connected } = useSocket();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200/70 bg-white/80 px-4 backdrop-blur-md sm:px-6 dark:border-ink-800 dark:bg-ink-900/80">
          <button type="button" className="btn btn-ghost btn-icon lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <span
              className={`hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold sm:flex ${connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-400'}`}
              title={connected ? 'Real-time updates connected' : 'Reconnecting…'}
            >
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {connected ? 'Live' : 'Offline'}
            </span>
            <button type="button" onClick={toggleTheme} className="btn btn-ghost btn-icon" aria-label="Toggle dark mode">
              {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 animate-fade-in" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
