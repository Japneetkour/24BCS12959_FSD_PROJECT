import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
        <Compass className="h-8 w-8" />
      </div>
      <p className="font-mono text-sm text-brand-600 dark:text-brand-400">404</p>
      <h1 className="mt-1 text-2xl font-extrabold">This page wandered off campus</h1>
      <p className="muted mt-2 max-w-sm text-sm">The page you're looking for doesn't exist or you don't have access to it.</p>
      <Link to="/dashboard" className="btn btn-primary mt-6">Back to dashboard</Link>
    </div>
  );
}
