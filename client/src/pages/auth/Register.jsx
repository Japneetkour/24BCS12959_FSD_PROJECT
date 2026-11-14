import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MailCheck, UserPlus } from 'lucide-react';
import AuthLayout, { DevLinkNotice } from './AuthLayout';
import Button from '../../components/ui/Button';
import { Input, PasswordInput, Select, fieldErrors } from '../../components/ui/Form';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { DEPARTMENTS, SEMESTERS } from '../../utils/constants';

function passwordStrength(p) {
  let score = 0;
  if (p.length >= 8) score += 1;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
  if (/\d/.test(p)) score += 1;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) score += 1;
  return score;
}
const STRENGTH = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', department: 'Computer Science', semester: 1, rollNumber: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const strength = passwordStrength(form.password);

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const { data, message } = await authApi.register({ ...form, semester: Number(form.semester) });
      if (data.user) {
        // Verification disabled on the server → already signed in.
        setUser(data.user);
        toast.success('Account created!');
        navigate('/dashboard');
      } else {
        setDone({ ...data, message });
      }
    } catch (err) {
      setErrors({ ...fieldErrors(err), form: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Check your inbox" subtitle={done.message}>
        <div className="rounded-2xl border border-ink-200 p-6 text-center dark:border-ink-700">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
            <MailCheck className="h-7 w-7" />
          </div>
          <p className="text-sm">
            We sent a verification link to <strong>{done.email}</strong>. Click it to activate your account.
          </p>
          <DevLinkNotice link={done.devLink} />
        </div>
        <Link to="/login" className="btn btn-secondary mt-6 w-full">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Use your university email address — we'll verify it."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && !Object.keys(errors).some((k) => k !== 'form') && (
          <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{errors.form}</div>
        )}
        <Input label="Full name" name="name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} required />
        <Input label="University email" name="email" type="email" autoComplete="email" placeholder="you@university.edu" value={form.email} onChange={set('email')} error={errors.email} required />
        <div>
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" error={errors.password} hint="At least 8 characters with upper & lower case letters and a number." />
          {form.password && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? STRENGTH_COLOR[strength] : 'bg-ink-200 dark:bg-ink-700'}`} />
                ))}
              </div>
              <span className="muted text-[11px] font-semibold">{STRENGTH[strength]}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Department" name="department" value={form.department} onChange={set('department')} options={DEPARTMENTS} error={errors.department} />
          <Select label="Semester" name="semester" value={form.semester} onChange={set('semester')} options={SEMESTERS.map((s) => ({ value: s, label: `Semester ${s}` }))} error={errors.semester} />
        </div>
        <Input label="Roll number (optional)" name="rollNumber" value={form.rollNumber} onChange={set('rollNumber')} error={errors.rollNumber} />
        <Button type="submit" className="w-full py-2.5" loading={loading} icon={UserPlus}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
