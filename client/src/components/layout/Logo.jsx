import { Link } from 'react-router-dom';

export default function Logo({ to = '/dashboard', light = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="CampusConnect home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#5443ea" />
        <path d="M9 20.5 16 9l7 11.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="21.5" r="2.4" fill="#ffd166" />
      </svg>
      <span className={`text-[15px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink-900 dark:text-white'}`}>
        Campus<span className="text-brand-600 dark:text-brand-400">Connect</span>
      </span>
    </Link>
  );
}
