import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, MailWarning } from 'lucide-react';
import AuthLayout, { DevLinkNotice } from './AuthLayout';
import Button from '../../components/ui/Button';
import { Input, PasswordInput, fieldErrors } from '../../components/ui/Form';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';

const DEMO = [
  { label: 'Student demo', email: 'aarav@campusconnect.edu', password: 'Student@123' },
  { label: 'Admin demo', email: 'admin@campusconnect.edu', password: 'Admin@123' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [devLink, setDevLink] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setUnverified(false);
    setLoading(true);
    try {
      const { user } = await login(form);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(location.state?.from?.pathname || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverified(true);
      setErrors({ ...fieldErrors(err), form: err.message });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      const { data, message } = await authApi.resendVerification(form.email);
      toast.success(message);
      setDevLink(data?.devLink || null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your university account to continue."
      footer={
        <>
          New to CampusConnect?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && !unverified && (
          <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{errors.form}</div>
        )}
        {unverified && (
          <div className="rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="flex items-center gap-2 font-semibold">
              <MailWarning className="h-4 w-4" /> Email not verified
            </p>
            <p className="mt-1">Check your inbox for the verification link.</p>
            <button type="button" onClick={resend} className="mt-2 font-semibold underline">
              Resend verification email
            </button>
            <DevLinkNotice link={devLink} />
          </div>
        )}
        <Input label="University email" name="email" type="email" autoComplete="email" placeholder="you@university.edu" value={form.email} onChange={set('email')} error={errors.email} required />
        <div>
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="current-password" error={errors.password} required />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" className="w-full py-2.5" loading={loading} icon={LogIn}>
          Sign in
        </Button>
      </form>

      <div className="mt-8">
        <div className="relative mb-4 text-center">
          <span className="relative z-10 bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:bg-ink-900">Try a demo account</span>
          <span className="absolute inset-x-0 top-1/2 h-px bg-ink-200 dark:bg-ink-700" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setForm({ email: d.email, password: d.password })}
              className="rounded-xl border border-ink-200 px-3 py-2 text-left text-xs transition hover:border-brand-300 hover:bg-brand-50 dark:border-ink-700 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10"
            >
              <span className="block font-semibold text-ink-800 dark:text-ink-100">{d.label}</span>
              <span className="muted block truncate">{d.email}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
