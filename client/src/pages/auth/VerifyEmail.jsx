import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function VerifyEmail() {
  const { token } = useParams();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', message: '' });
  const ran = useRef(false); // StrictMode runs effects twice in dev; tokens are single-use

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    authApi
      .verifyEmail(token)
      .then(({ data, message }) => {
        setUser(data.user);
        setState({ status: 'success', message });
        setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
      })
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, [token, setUser, navigate]);

  return (
    <AuthLayout title="Email verification">
      <div className="rounded-2xl border border-ink-200 p-8 text-center dark:border-ink-700">
        {state.status === 'loading' && (
          <>
            <Spinner className="mx-auto h-8 w-8 text-brand-500" />
            <p className="muted mt-4 text-sm">Verifying your email…</p>
          </>
        )}
        {state.status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="mt-4 font-semibold">{state.message}</p>
            <p className="muted mt-1 text-sm">Redirecting to your dashboard…</p>
          </>
        )}
        {state.status === 'error' && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-rose-500" />
            <p className="mt-4 font-semibold">{state.message}</p>
            <p className="muted mt-1 text-sm">Sign in to request a new verification link.</p>
            <Link to="/login" className="btn btn-primary mt-6">
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
