import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui/Spinner';

/** Requires a logged-in user; remembers where they were going. */
export function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <PageLoader label="Restoring your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Requires the admin role. */
export function AdminRoute() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

/** Login/register pages: redirect away if already signed in. */
export function GuestRoute() {
  const { isAuthenticated, initializing } = useAuth();
  if (initializing) return <PageLoader />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
