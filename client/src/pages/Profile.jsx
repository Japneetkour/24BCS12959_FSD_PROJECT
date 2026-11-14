import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Save, KeyRound, Moon, Sun, ShieldCheck, Mail } from 'lucide-react';
import { authApi, userApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/ui/Button';
import { Input, PasswordInput, Select, Textarea, Toggle, fieldErrors } from '../components/ui/Form';
import { Avatar, Badge, PageHeader } from '../components/ui/Display';
import { DEPARTMENTS, SEMESTERS } from '../utils/constants';
import { fmtDate } from '../utils/format';

export default function Profile() {
  const { user, setUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ name: user.name, department: user.department, semester: user.semester, rollNumber: user.rollNumber || '', bio: user.bio || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [pwSaving, setPwSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { user: updated } = await userApi.updateMe({ ...form, semester: Number(form.semester) });
      setUser(updated);
      toast.success('Profile saved');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB');
      return;
    }
    setUploading(true);
    try {
      const { user: updated } = await userApi.uploadAvatar(file);
      setUser(updated);
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) {
      setPwErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setPwSaving(true);
    setPwErrors({});
    try {
      const { message } = await authApi.updatePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success(message);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwErrors({ ...fieldErrors(err), currentPassword: fieldErrors(err).currentPassword || (err.status === 400 ? err.message : undefined) });
      toast.error(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Profile & settings" description="Manage your personal information, appearance and security." />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="card card-pad h-fit text-center">
          <div className="relative mx-auto w-fit">
            <Avatar user={user} size="xl" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-white shadow ring-2 ring-white hover:bg-brand-700 dark:ring-ink-900"
              aria-label="Change photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadAvatar(e.target.files[0])} />
          </div>
          <h2 className="mt-4 text-lg font-bold">{user.name}</h2>
          <p className="muted flex items-center justify-center gap-1 text-xs"><Mail className="h-3 w-3" /> {user.email}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Badge tone={user.role === 'admin' ? 'violet' : 'brand'}>{user.role === 'admin' ? 'Administrator' : 'Student'}</Badge>
            {user.isVerified && <Badge tone="green"><ShieldCheck className="h-3 w-3" /> Verified</Badge>}
          </div>
          <p className="muted mt-4 text-xs">Member since {fmtDate(user.createdAt, 'MMMM yyyy')}</p>
        </aside>

        <div className="space-y-6">
          <form onSubmit={saveProfile} className="card card-pad space-y-4" noValidate>
            <h3 className="section-title">Personal information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" name="name" value={form.name} onChange={set('name')} error={errors.name} />
              <Input label="Roll number" name="rollNumber" value={form.rollNumber} onChange={set('rollNumber')} error={errors.rollNumber} />
              <Select label="Department" name="department" value={form.department} onChange={set('department')} options={DEPARTMENTS} />
              <Select label="Semester" name="semester" value={form.semester} onChange={set('semester')} options={SEMESTERS.map((s) => ({ value: s, label: `Semester ${s}` }))} />
            </div>
            <Textarea label="Bio" name="bio" value={form.bio} onChange={set('bio')} maxLength={300} rows={3} hint={`${form.bio.length}/300`} error={errors.bio} />
            <p className="muted text-xs">Your department and semester decide which announcements you receive.</p>
            <div className="flex justify-end">
              <Button type="submit" icon={Save} loading={saving}>Save changes</Button>
            </div>
          </form>

          <div className="card card-pad">
            <h3 className="section-title mb-4">Appearance</h3>
            <Toggle
              checked={isDark}
              onChange={toggleTheme}
              label={<span className="flex items-center gap-2">{isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Dark mode</span>}
              description="Easier on the eyes for late-night study sessions."
            />
          </div>

          <form onSubmit={changePassword} className="card card-pad space-y-4" noValidate>
            <h3 className="section-title">Change password</h3>
            <PasswordInput label="Current password" name="currentPassword" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} error={pwErrors.currentPassword} autoComplete="current-password" />
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordInput label="New password" name="newPassword" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} error={pwErrors.newPassword} autoComplete="new-password" />
              <PasswordInput label="Confirm new password" name="confirm" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} error={pwErrors.confirm} autoComplete="new-password" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" icon={KeyRound} loading={pwSaving} disabled={!pw.currentPassword || !pw.newPassword}>Update password</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
