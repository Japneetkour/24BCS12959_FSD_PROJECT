import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, CheckSquare, CalendarDays, Users, FolderOpen, PartyPopper, Megaphone, BarChart3, History,
  ShieldCheck, UserCog, FileStack, X, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from './Logo';

const MAIN = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
];
const CAMPUS = [
  { to: '/groups', label: 'Study Groups', icon: Users },
  { to: '/resources', label: 'Resources', icon: FolderOpen },
  { to: '/events', label: 'Events', icon: PartyPopper },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
];
const INSIGHTS = [
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/activity', label: 'Activity', icon: History },
];
const ADMIN = [
  { to: '/admin', label: 'Overview', icon: ShieldCheck, end: true },
  { to: '/admin/users', label: 'Students', icon: UserCog },
  { to: '/admin/resources', label: 'Uploads', icon: FileStack },
];

function Section({ title, items, onNavigate }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[.12em] text-ink-400 dark:text-ink-500">{title}</p>
      <nav className="space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => clsx('nav-link', isActive && 'nav-link-active')}>
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  const { isAdmin, user } = useAuth();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink-950/40 lg:hidden" onClick={onClose} />}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-200/70 bg-white transition-transform duration-200 dark:border-ink-800 dark:bg-ink-900',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button type="button" className="btn btn-ghost btn-icon lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <Section title="Workspace" items={MAIN} onNavigate={onClose} />
          <Section title="Campus" items={CAMPUS} onNavigate={onClose} />
          <Section title="Insights" items={INSIGHTS} onNavigate={onClose} />
          {isAdmin && <Section title="Administration" items={ADMIN} onNavigate={onClose} />}
        </div>

        <div className="m-3 rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-4 text-white">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="h-4 w-4" /> {isAdmin ? 'Admin mode' : `Semester ${user?.semester}`}
          </div>
          <p className="mt-1 text-xs text-white/80">
            {isAdmin ? 'You can manage students, events and announcements.' : user?.department}
          </p>
        </div>
      </aside>
    </>
  );
}
