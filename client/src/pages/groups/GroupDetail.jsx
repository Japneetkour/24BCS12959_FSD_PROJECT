import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Lock, Settings, LogOut, Trash2, UserPlus, MessageCircle, FolderOpen, Crown, Shield, UploadCloud, MoreVertical,
} from 'lucide-react';
import { groupApi, resourceApi, userApi } from '../../api';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import Button from '../../components/ui/Button';
import Modal, { ConfirmDialog } from '../../components/ui/Modal';
import { Avatar, Badge, Tabs } from '../../components/ui/Display';
import { EmptyState, ErrorState } from '../../components/ui/Feedback';
import { PageLoader } from '../../components/ui/Spinner';
import ChatPanel from '../../components/groups/ChatPanel';
import GroupForm from '../../components/groups/GroupForm';
import ResourceCard from '../../components/resources/ResourceCard';
import UploadModal from '../../components/resources/UploadModal';
import { fmtDate, timeAgo } from '../../utils/format';

function InviteModal({ open, onClose, group, onInvited }) {
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(null);
  const debounced = useDebounce(q.trim(), 300);
  const results = useAsync(() => (debounced.length >= 2 ? userApi.search(debounced) : Promise.resolve([])), [debounced]);
  const memberIds = new Set(group.members.map((m) => m.user?._id));
  const invitedIds = new Set((group.invites || []).map((i) => i.user?._id));

  const invite = async (email) => {
    setSending(email);
    try {
      const { message } = await groupApi.invite(group._id, email);
      toast.success(message);
      onInvited?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite students" description="Search by name, email or roll number. They'll get a real-time notification.">
      <input className="input" placeholder="Start typing a name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
        {debounced.length < 2 && <p className="muted py-6 text-center text-sm">Type at least 2 characters.</p>}
        {debounced.length >= 2 && results.data?.length === 0 && <p className="muted py-6 text-center text-sm">No students found.</p>}
        {results.data?.map((u) => {
          const status = memberIds.has(u._id) ? 'Member' : invitedIds.has(u._id) ? 'Invited' : null;
          return (
            <div key={u._id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-850">
              <Avatar user={u} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{u.name}</p>
                <p className="muted truncate text-xs">{u.email} · {u.department}</p>
              </div>
              {status ? <Badge tone="gray">{status}</Badge> : (
                <Button size="sm" loading={sending === u.email} onClick={() => invite(u.email)}>Invite</Button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function MemberRow({ member, group, me, onChanged }) {
  const [open, setOpen] = useState(false);
  const isOwner = group.myRole === 'owner' || me.role === 'admin';
  const canRemove = member.role !== 'owner' && member.user._id !== me._id && (isOwner || (group.myRole === 'admin' && member.role === 'member'));
  const canPromote = isOwner && member.role !== 'owner';

  const act = async (fn, msg) => {
    setOpen(false);
    try {
      await fn();
      toast.success(msg);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-850">
      <Avatar user={member.user} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {member.user.name} {member.user._id === me._id && <span className="muted font-normal">(you)</span>}
        </p>
        <p className="muted truncate text-xs">{member.user.department} · Sem {member.user.semester} · joined {fmtDate(member.joinedAt)}</p>
      </div>
      {member.role === 'owner' && <Badge tone="amber"><Crown className="h-3 w-3" /> Owner</Badge>}
      {member.role === 'admin' && <Badge tone="brand"><Shield className="h-3 w-3" /> Admin</Badge>}
      {(canRemove || canPromote) && (
        <div className="relative">
          <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-ghost btn-icon" aria-label="Member actions">
            <MoreVertical className="h-4 w-4" />
          </button>
          {open && (
            <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-ink-200 bg-white p-1 shadow-pop dark:border-ink-700 dark:bg-ink-900">
              {canPromote && member.role === 'member' && (
                <button type="button" className="nav-link w-full" onClick={() => act(() => groupApi.setRole(group._id, member.user._id, 'admin'), 'Promoted to admin')}>Make group admin</button>
              )}
              {canPromote && member.role === 'admin' && (
                <button type="button" className="nav-link w-full" onClick={() => act(() => groupApi.setRole(group._id, member.user._id, 'member'), 'Admin rights removed')}>Remove admin</button>
              )}
              {canPromote && (
                <button type="button" className="nav-link w-full" onClick={() => act(() => groupApi.setRole(group._id, member.user._id, 'owner'), 'Ownership transferred')}>Transfer ownership</button>
              )}
              {canRemove && (
                <button type="button" className="nav-link w-full text-rose-600" onClick={() => act(() => groupApi.removeMember(group._id, member.user._id), 'Member removed')}>Remove from group</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('chat');
  const [modal, setModal] = useState(null); // 'invite' | 'settings' | 'upload' | 'leave' | 'delete'
  const [busy, setBusy] = useState(false);
  const { data: group, loading, error, reload, setData } = useAsync(() => groupApi.get(id), [id]);
  const materials = useAsync(() => (group?.isMember ? resourceApi.list({ group: id, limit: 50 }) : Promise.resolve(null)), [id, group?.isMember]);

  useSocketEvent('group:updated', ({ groupId }) => groupId === id && reload({ silent: true }));
  useSocketEvent('group:deleted', ({ groupId }) => {
    if (groupId === id) {
      toast('This group was deleted', { icon: '🗑️' });
      navigate('/groups');
    }
  });

  if (loading && !group) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const join = async () => {
    setBusy(true);
    try {
      const g = group.isInvited ? await groupApi.respond(id, true) : await groupApi.join(id);
      toast.success(`Welcome to ${group.name}!`);
      setData(g);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const leaveOrDelete = async () => {
    setBusy(true);
    try {
      if (modal === 'delete') await groupApi.remove(id);
      else await groupApi.leave(id);
      toast.success(modal === 'delete' ? 'Group deleted' : `You left ${group.name}`);
      navigate('/groups');
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
      setModal(null);
    }
  };

  const canManage = group.myRole === 'owner' || group.myRole === 'admin' || user.role === 'admin';
  const isOwner = group.myRole === 'owner' || user.role === 'admin';

  return (
    <div>
      <Link to="/groups" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">
        <ArrowLeft className="h-4 w-4" /> All groups
      </Link>

      <div className="card mb-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold">{group.name}</h1>
              {group.isPrivate && <Badge tone="gray"><Lock className="h-3 w-3" /> Private</Badge>}
              <Badge tone="brand">{group.subject}</Badge>
            </div>
            <p className="muted mt-2 max-w-2xl text-sm">{group.description || 'No description.'}</p>
            <p className="mt-3 text-xs text-ink-400">
              Created by {group.owner?.name} · {group.memberCount}/{group.maxMembers} members · active {timeAgo(group.lastActivityAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.isMember ? (
              <>
                {canManage && <Button variant="secondary" icon={UserPlus} onClick={() => setModal('invite')}>Invite</Button>}
                {canManage && <Button variant="secondary" icon={Settings} onClick={() => setModal('settings')}>Settings</Button>}
                {group.myRole !== 'owner' && <Button variant="secondary" icon={LogOut} onClick={() => setModal('leave')}>Leave</Button>}
                {isOwner && <Button variant="danger" icon={Trash2} onClick={() => setModal('delete')}>Delete</Button>}
              </>
            ) : (
              <>
                {user.role === 'admin' && <Button variant="danger" icon={Trash2} onClick={() => setModal('delete')}>Delete</Button>}
                <Button onClick={join} loading={busy} disabled={group.memberCount >= group.maxMembers}>
                  {group.isInvited ? 'Accept invitation' : group.memberCount >= group.maxMembers ? 'Group is full' : 'Join group'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {!group.isMember ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="card">
            <EmptyState icon={MessageCircle} title="Join to see the conversation" description="Members can chat in real time, share files and see study materials." />
          </div>
          <div className="card card-pad">
            <h3 className="section-title mb-3">Members</h3>
            {group.members.slice(0, 8).map((m) => (
              <div key={m.user._id} className="flex items-center gap-2 py-1.5">
                <Avatar user={m.user} size="sm" />
                <span className="text-sm">{m.user.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'chat', label: 'Chat' },
                { value: 'members', label: 'Members', count: group.memberCount },
                { value: 'materials', label: 'Materials', count: materials.data?.pagination.total },
              ]}
            />
            {tab === 'materials' && <Button size="sm" icon={UploadCloud} onClick={() => setModal('upload')}>Share file</Button>}
          </div>

          {tab === 'chat' && <ChatPanel group={group} />}

          {tab === 'members' && (
            <div className="p-3">
              {group.members.map((m) => <MemberRow key={m.user._id} member={m} group={group} me={user} onChanged={() => reload({ silent: true })} />)}
              {canManage && group.invites?.length > 0 && (
                <div className="mt-4 border-t border-ink-100 pt-4 dark:border-ink-800">
                  <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-ink-400">Pending invitations</p>
                  {group.invites.map((i) => (
                    <div key={i.user._id} className="flex items-center gap-3 px-3 py-2">
                      <Avatar user={i.user} size="sm" />
                      <span className="flex-1 text-sm">{i.user.name} <span className="muted text-xs">· invited by {i.invitedBy?.name}</span></span>
                      <Badge tone="amber">Pending</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'materials' && (
            <div className="p-4">
              {materials.data?.items.length === 0 && (
                <EmptyState icon={FolderOpen} title="No shared materials yet" description="Files shared here are visible only to group members." action={<Button icon={UploadCloud} onClick={() => setModal('upload')}>Share a file</Button>} />
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {materials.data?.items.map((r) => (
                  <ResourceCard
                    key={r._id}
                    resource={r}
                    onChange={(x) => materials.setData((d) => ({ ...d, items: d.items.map((y) => (y._id === x._id ? x : y)) }))}
                    onDelete={async (x) => {
                      try {
                        await resourceApi.remove(x._id);
                        toast.success('File removed');
                        materials.reload({ silent: true });
                      } catch (err) {
                        toast.error(err.message);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <InviteModal open={modal === 'invite'} onClose={() => setModal(null)} group={group} onInvited={() => reload({ silent: true })} />
      <GroupForm open={modal === 'settings'} onClose={() => setModal(null)} group={group} onSaved={() => reload({ silent: true })} />
      <UploadModal open={modal === 'upload'} onClose={() => setModal(null)} group={group} onUploaded={() => materials.reload({ silent: true })} />
      <ConfirmDialog
        open={modal === 'leave' || modal === 'delete'}
        onClose={() => setModal(null)}
        onConfirm={leaveOrDelete}
        loading={busy}
        title={modal === 'delete' ? 'Delete this group?' : 'Leave this group?'}
        confirmLabel={modal === 'delete' ? 'Delete group' : 'Leave group'}
        message={modal === 'delete' ? 'All messages and shared files will be permanently deleted for every member.' : 'You will lose access to the chat and shared materials.'}
      />
    </div>
  );
}
