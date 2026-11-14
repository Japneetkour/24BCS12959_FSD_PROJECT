import { CheckCircle2, MessagesSquare, CalendarClock, BarChart3 } from 'lucide-react';
import Logo from '../../components/layout/Logo';

const FEATURES = [
  { icon: CalendarClock, title: 'Never miss a deadline', text: 'Smart task prioritisation plus reminders for every assignment.' },
  { icon: MessagesSquare, title: 'Study together, live', text: 'Real-time group chat and shared notes for every subject.' },
  { icon: BarChart3, title: 'See your progress', text: 'Analytics on completion, on-time rate and weekly activity.' },
];

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_640px]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="relative">
          <Logo to="/login" light />
        </div>
        <div className="relative my-auto max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Built for university students
          </p>
          <h2 className="text-4xl font-extrabold leading-tight text-white">
            Your semester, <span className="bg-gradient-to-r from-brand-300 to-amber-200 bg-clip-text text-transparent">organised</span> in one place.
          </h2>
          <p className="mt-4 text-base text-white/70">
            Tasks, study groups, notes, campus events and announcements — connected, real-time and personalised.
          </p>
          <div className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                  <Icon className="h-5 w-5 text-brand-200" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/60">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} CampusConnect · Smart University Management Platform</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center bg-white px-6 py-10 sm:px-12 dark:bg-ink-900">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo to="/login" />
          </div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="muted mt-1.5 text-sm">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-ink-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/** Development helper: when SMTP is not configured the API returns the email link. */
export function DevLinkNotice({ link }) {
  if (!link) return null;
  const path = new URL(link).pathname;
  return (
    <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="font-semibold">Development mode — email not sent (SMTP not configured)</p>
      <a href={path} className="mt-1 block break-all font-mono underline">
        {path}
      </a>
    </div>
  );
}
