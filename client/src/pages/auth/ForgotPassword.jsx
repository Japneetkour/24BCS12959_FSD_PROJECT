import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, MailCheck } from 'lucide-react';
import AuthLayout, { DevLinkNotice } from './AuthLayout';
import Button from '../../components/ui/Button';
import { Input, fieldErrors } from '../../components/ui/Form';
import { authApi } from '../../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, message } = await authApi.forgotPassword(email);
      setSent({ message, devLink: data?.devLink });
    } catch (err) {
      setError(fieldErrors(err).email || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your university email and we'll send you a secure reset link."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-2xl border border-ink-200 p-6 text-center dark:border-ink-700">
          <MailCheck className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-3 text-sm">{sent.message}</p>
          <p className="muted mt-1 text-xs">The link expires in 30 minutes.</p>
          <DevLinkNotice link={sent.devLink} />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label="University email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoComplete="email" required />
          <Button type="submit" className="w-full py-2.5" loading={loading} icon={Send}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
