import { useState } from 'react';
import toast from 'react-hot-toast';
import { UserCog, ShieldCheck, Ban, CheckCircle2, Trash2, Eye, Shield } from 'lucide-react';
import { adminApi } from '../../api';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Avatar, Badge, PageHeader, Pagination, SearchInput } from '../../components/ui/Display';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { PageLoader } from '../../components/ui/Spinner';
import { DEPARTMENTS } from '../../utils/constants';
import { fmtDate, fmtDateTime, timeAgo } from '../../utils/format';

function UserDetail({ userId, onClose }) {
  const { data, loading, error } = useAsync(() => (userId ? adminApi.user(userId) : Promise.resolve(null)), [userId]);
  return (
    <Modal open={Boolean(userId)} onClose={onClose} title="Student details" size="lg">
      {loading && <PageLoader />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar user={data.user} size="lg" />
            <div>
              <p className="text-lg font-bold">{data.user.name}</p>
              <p className="muted text-sm">{data.user.email}</p>
              <p className="muted text-xs">{data.user.department} · Semester {data.user.semester}{data.user.rollNumber && ` · ${data.user.rollNumber}`}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {[['Tasks', data.stats.tasks], ['Completed', data.stats.completed], ['Uploads', data.stats.resources], ['Groups', data.stats.groups], ['Events', data.stats.registrations]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-ink-50 p-3 text-center dark:bg-ink-850">
                <p className="font-mono text-xl">{v}</p>
                <p className="muted text-[11px] font-semibold uppercase">{l}</p>
              </div>
            ))}
          </div>
          <div className="text-xs text-ink-500">
            Joined {fmtDate(data.user.createdAt)} · Last login {data.user.lastLoginAt ? fmtDateTime(data.user.lastLoginAt) : 'never'}
          </div>
          <div>
            <p className="section-title mb-2">Recent activity</p>
            {data.recentActivity.length === 0 ? <p className="muted text-sm">No activity.</p> : (
              <ul className="space-y-1.5">
                {data.recentActivity.map((a) => (
                  <li key={a._id} className="flex justify-between gap-3 text-sm">
                    <span>{a.description}</span>
                    <span className="muted shrink-0 text-xs">{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ role: '', department: '', status: '' });
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounce(search);

  const list = useAsync(
    () => adminApi.users({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), search: q || undefined, page, limit: 15 }),
    [q, filters.role, filters.department, filters.status, page]
  );

  const setFilter = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const update = async (u, body, msg) => {
    try {
      const updated = await adminApi.updateUser(u._id, body);
      list.setData((d) => ({ ...d, items: d.items.map((x) => (x._id === updated._id ? updated : x)) }));
      toast.success(msg);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await adminApi.deleteUser(deleting._id);
      toast.success(`${deleting.name}'s account deleted`);
      setDeleting(null);
      list.reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Manage students" description="Search accounts, change roles, suspend or remove users." />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center dark:border-ink-800">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, email or roll number…" className="lg:w-80" />
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <select className="select h-9 w-auto py-1 text-xs" value={filters.role} onChange={(e) => setFilter('role', e.target.value)} aria-label="Role">
              <option value="">All roles</option>
              <option value="student">Students</option>
              <option value="admin">Admins</option>
            </select>
            <select className="select h-9 w-auto py-1 text-xs" value={filters.department} onChange={(e) => setFilter('department', e.target.value)} aria-label="Department">
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="select h-9 w-auto py-1 text-xs" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>

        {list.loading && !list.data && <SkeletonList rows={8} className="p-5" />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data?.items.length === 0 && <EmptyState icon={UserCog} title="No users found" />}
        {list.data?.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-ink-100 text-[11px] uppercase tracking-wider text-ink-400 dark:border-ink-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-3 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Last login</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {list.data.items.map((u) => {
                  const self = u._id === me._id;
                  return (
                    <tr key={u._id} className="hover:bg-ink-50/60 dark:hover:bg-ink-850/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{u.name} {self && <span className="muted font-normal">(you)</span>}</p>
                            <p className="muted truncate text-xs">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs">{u.department}<span className="muted"> · Sem {u.semester}</span></td>
                      <td className="px-3 py-3">{u.role === 'admin' ? <Badge tone="violet"><Shield className="h-3 w-3" /> Admin</Badge> : <Badge tone="brand">Student</Badge>}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.isActive ? <Badge tone="green" dot>Active</Badge> : <Badge tone="red" dot>Suspended</Badge>}
                          {!u.isVerified && <Badge tone="amber">Unverified</Badge>}
                        </div>
                      </td>
                      <td className="muted px-3 py-3 text-xs">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button type="button" className="btn btn-ghost btn-icon" title="View details" onClick={() => setViewing(u._id)}><Eye className="h-4 w-4" /></button>
                          {!u.isVerified && (
                            <button type="button" className="btn btn-ghost btn-icon" title="Mark as verified" onClick={() => update(u, { isVerified: true }, 'Marked as verified')}><CheckCircle2 className="h-4 w-4" /></button>
                          )}
                          {!self && (
                            <>
                              <button type="button" className="btn btn-ghost btn-icon" title={u.role === 'admin' ? 'Make student' : 'Make admin'} onClick={() => update(u, { role: u.role === 'admin' ? 'student' : 'admin' }, 'Role updated')}><ShieldCheck className="h-4 w-4" /></button>
                              <button type="button" className={`btn btn-ghost btn-icon ${u.isActive ? 'hover:text-amber-600' : 'text-rose-600'}`} title={u.isActive ? 'Suspend' : 'Reactivate'} onClick={() => update(u, { isActive: !u.isActive }, u.isActive ? 'Account suspended' : 'Account reactivated')}><Ban className="h-4 w-4" /></button>
                              <button type="button" className="btn btn-ghost btn-icon hover:text-rose-600" title="Delete" onClick={() => setDeleting(u)}><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 pb-4"><Pagination pagination={list.data?.pagination} onChange={setPage} /></div>
      </div>

      <UserDetail userId={viewing} onClose={() => setViewing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title={`Delete ${deleting?.name}?`}
        confirmLabel="Delete account"
        message="This permanently removes the account with its tasks, uploads, registrations and notifications. Groups they own are transferred to another member."
      />
    </div>
  );
}
