import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Button from '../../components/ui/Button';
import { PasswordInput, fieldErrors } from '../../components/ui/Form';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function ResetPassword() {
  const { token } = useParams();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { data, message } = await authApi.resetPassword(token, password);
      setUser(data.user);
      toast.success(message);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrors({ ...fieldErrors(err), form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Your new password must be different from previously used passwords."
      footer={
        <Link to="/forgot-password" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Request a new link
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && !errors.password && (
          <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{errors.form}</div>
        )}
        <PasswordInput label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" error={errors.password} hint="At least 8 characters with upper & lower case letters and a number." />
        <PasswordInput label="Confirm password" name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" error={errors.confirm} />
        <Button type="submit" className="w-full py-2.5" loading={loading} icon={KeyRound}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
