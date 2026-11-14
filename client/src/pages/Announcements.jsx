import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Megaphone, Pin, Pencil, Trash2, Plus, AlertCircle, Users } from 'lucide-react';
import { announcementApi } from '../api';
import useAsync from '../hooks/useAsync';
import useDebounce from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Button from '../components/ui/Button';
import Modal, { ConfirmDialog } from '../components/ui/Modal';
import { Input, Select, Textarea, Toggle, fieldErrors } from '../components/ui/Form';
import { Badge, PageHeader, Pagination, SearchInput } from '../components/ui/Display';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/Feedback';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_TONE, DEPARTMENTS, SEMESTERS } from '../utils/constants';
import { capitalize, fmtDateTime, timeAgo } from '../utils/format';

function AnnouncementForm({ open, onClose, announcement, onSaved }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      title: announcement?.title || '',
      content: announcement?.content || '',
      category: announcement?.category || 'general',
      department: announcement?.department || 'All',
      semester: announcement?.semester ?? 0,
      priority: announcement?.priority || 'normal',
      isPinned: announcement?.isPinned || false,
    });
  }, [open, announcement]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = { ...form, semester: Number(form.semester) };
    try {
      if (announcement) {
        await announcementApi.update(announcement._id, body);
        toast.success('Announcement updated');
      } else {
        const { message } = await announcementApi.create(body);
        toast.success(message);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={announcement ? 'Edit announcement' : 'New announcement'}
      description={announcement ? undefined : 'Targeted students receive a real-time notification.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="ann-form" loading={saving}>{announcement ? 'Save' : 'Publish'}</Button>
        </>
      }
    >
      <form id="ann-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input className="sm:col-span-2" label="Title" name="title" value={form.title || ''} onChange={set('title')} error={errors.title} />
        <Textarea className="sm:col-span-2" label="Message" name="content" rows={6} value={form.content || ''} onChange={set('content')} error={errors.content} />
        <Select label="Category" name="category" value={form.category} onChange={set('category')} options={ANNOUNCEMENT_CATEGORIES.map((c) => ({ value: c, label: capitalize(c) }))} />
        <Select label="Priority" name="priority" value={form.priority} onChange={set('priority')} options={[{ value: 'normal', label: 'Normal' }, { value: 'important', label: 'Important' }]} />
        <Select label="Department" name="department" value={form.department} onChange={set('department')} options={[{ value: 'All', label: 'All departments' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]} />
        <Select label="Semester" name="semester" value={form.semester} onChange={set('semester')} options={[{ value: 0, label: 'All semesters' }, ...SEMESTERS.map((s) => ({ value: s, label: `Semester ${s}` }))]} />
        <div className="sm:col-span-2">
          <Toggle checked={Boolean(form.isPinned)} onChange={(v) => setForm((f) => ({ ...f, isPinned: v }))} label="Pin to top" description="Pinned announcements always appear first." />
        </div>
      </form>
    </Modal>
  );
}

export default function Announcements() {
  const { isAdmin } = useAuth();
  const { onNotification } = useSocket();
  const [params] = useSearchParams();
  const highlight = params.get('highlight');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounce(search);

  const list = useAsync(() => announcementApi.list({ category: category || undefined, search: q || undefined, page, limit: 10 }), [category, q, page]);
  // A highlighted announcement (from a notification) may not be on page 1 — fetch it separately.
  const focused = useAsync(() => (highlight ? announcementApi.get(highlight).catch(() => null) : Promise.resolve(null)), [highlight]);

  useEffect(
    () => onNotification((n) => n.type === 'announcement' && list.reload({ silent: true })),
    [onNotification] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (highlight && focused.data) document.getElementById(`ann-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight, focused.data]);

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await announcementApi.remove(deleting._id);
      toast.success('Announcement deleted');
      setDeleting(null);
      list.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const items = list.data?.items || [];
  const showFocused = focused.data && !items.some((a) => a._id === focused.data._id);

  const Card = ({ a }) => (
    <article
      id={`ann-${a._id}`}
      className={clsx(
        'card p-5 transition',
        a._id === highlight && 'ring-2 ring-brand-500',
        a.priority === 'important' && 'border-l-4 border-l-rose-500 dark:border-l-rose-500'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {a.isPinned && <Badge tone="brand"><Pin className="h-3 w-3" /> Pinned</Badge>}
        <Badge tone={ANNOUNCEMENT_TONE[a.category]}>{capitalize(a.category)}</Badge>
        {a.priority === 'important' && <Badge tone="red"><AlertCircle className="h-3 w-3" /> Important</Badge>}
        <Badge tone="gray"><Users className="h-3 w-3" /> {a.department === 'All' ? 'All departments' : a.department}{a.semester ? ` · Sem ${a.semester}` : ''}</Badge>
        {isAdmin && (
          <div className="ml-auto flex">
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Edit" onClick={() => { setEditing(a); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" className="btn btn-ghost btn-icon hover:text-rose-600" aria-label="Delete" onClick={() => setDeleting(a)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
      <h2 className="mt-3 text-lg font-bold">{a.title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700 dark:text-ink-300">{a.content}</p>
      <p className="muted mt-4 text-xs" title={fmtDateTime(a.createdAt)}>Posted by {a.author?.name || 'Administration'} · {timeAgo(a.createdAt)}</p>
    </article>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Campus"
        title="Announcements"
        description={isAdmin ? 'Publish updates to all students or a specific department and semester.' : 'Academic updates for your department and semester.'}
        actions={isAdmin && <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>New announcement</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search announcements…" className="flex-1" />
        <select className="select sm:w-48" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Category">
          <option value="">All categories</option>
          {ANNOUNCEMENT_CATEGORIES.map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
        </select>
      </div>

      {showFocused && <div className="mb-4"><Card a={focused.data} /></div>}
      {list.loading && !list.data && <div className="card p-5"><SkeletonList rows={4} /></div>}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && items.length === 0 && <div className="card"><EmptyState icon={Megaphone} title="No announcements" description="You're all caught up." /></div>}
      <div className="space-y-4">
        {items.map((a) => <Card key={a._id} a={a} />)}
      </div>
      <Pagination pagination={list.data?.pagination} onChange={setPage} />

      {isAdmin && <AnnouncementForm open={formOpen} onClose={() => setFormOpen(false)} announcement={editing} onSaved={() => list.reload({ silent: true })} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={busy} title="Delete announcement?" message={`"${deleting?.title}" will be removed for all students.`} />
    </div>
  );
}
