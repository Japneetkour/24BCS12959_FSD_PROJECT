import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Users, Lock, MessageCircle, Check, X } from 'lucide-react';
import { groupApi } from '../../api';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import Button from '../../components/ui/Button';
import { AvatarStack, Badge, PageHeader, Pagination, SearchInput, Tabs } from '../../components/ui/Display';
import { EmptyState, ErrorState, SkeletonGrid } from '../../components/ui/Feedback';
import GroupForm from '../../components/groups/GroupForm';
import { timeAgo } from '../../utils/format';

function GroupCard({ group, onJoin, joining }) {
  return (
    <article className="card flex flex-col p-5 transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/groups/${group._id}`} className="min-w-0">
          <h3 className="truncate text-[15px] font-bold hover:text-brand-600 dark:hover:text-brand-400">{group.name}</h3>
          <p className="muted text-xs">{group.subject}</p>
        </Link>
        {group.isPrivate ? <Badge tone="gray"><Lock className="h-3 w-3" /> Private</Badge> : <Badge tone="green">Open</Badge>}
      </div>
      <p className="muted mt-3 line-clamp-2 min-h-[2.5rem] text-sm">{group.description || 'No description yet.'}</p>
      {group.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {group.tags.slice(0, 3).map((t) => <Badge key={t} tone="brand">#{t}</Badge>)}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <AvatarStack users={group.members.map((m) => m.user)} total={group.memberCount} />
          <span className="muted text-xs">{group.memberCount}/{group.maxMembers}</span>
        </div>
        {group.isMember ? (
          <Link to={`/groups/${group._id}`} className="btn btn-secondary btn-sm">
            <MessageCircle className="h-3.5 w-3.5" /> Open
          </Link>
        ) : (
          <Button size="sm" onClick={() => onJoin(group)} loading={joining === group._id} disabled={group.memberCount >= group.maxMembers}>
            {group.memberCount >= group.maxMembers ? 'Full' : 'Join'}
          </Button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-ink-400">Active {timeAgo(group.lastActivityAt)}</p>
    </article>
  );
}

export default function Groups() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'discover';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [joining, setJoining] = useState(null);
  const q = useDebounce(search);

  const list = useAsync(
    () => (tab === 'invites' ? Promise.resolve(null) : groupApi.list({ mine: tab === 'mine' ? 'true' : undefined, search: q || undefined, page, limit: 12 })),
    [tab, q, page]
  );
  const invites = useAsync(() => groupApi.invites(), []);

  const setTab = (t) => {
    setParams(t === 'discover' ? {} : { tab: t });
    setPage(1);
  };

  const join = async (group) => {
    setJoining(group._id);
    try {
      await groupApi.join(group._id);
      toast.success(`Joined ${group.name}`);
      navigate(`/groups/${group._id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(null);
    }
  };

  const respond = async (inv, accept) => {
    try {
      await groupApi.respond(inv._id, accept);
      toast.success(accept ? `Joined ${inv.name}` : 'Invitation declined');
      invites.reload({ silent: true });
      if (accept) navigate(`/groups/${inv._id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const inviteCount = invites.data?.length || 0;

  return (
    <div>
      <PageHeader
        eyebrow="Campus"
        title="Study groups"
        description="Find peers studying the same subjects, share material and chat in real time."
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Create group</Button>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'discover', label: 'Discover' },
            { value: 'mine', label: 'My groups' },
            { value: 'invites', label: 'Invitations', count: inviteCount || undefined },
          ]}
        />
        {tab !== 'invites' && <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or subject…" className="sm:w-72" />}
      </div>

      {tab === 'invites' ? (
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {invites.loading && !invites.data && <div className="p-5"><SkeletonGrid count={1} className="h-16" /></div>}
          {invites.error && <ErrorState error={invites.error} onRetry={invites.reload} />}
          {invites.data?.length === 0 && <EmptyState icon={Users} title="No pending invitations" description="When someone invites you to a private group it will show up here." />}
          {invites.data?.map((inv) => (
            <div key={inv._id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{inv.name} {inv.isPrivate && <Lock className="ml-1 inline h-3.5 w-3.5 text-ink-400" />}</p>
                <p className="muted text-xs">{inv.subject} · {inv.memberCount} members · invited by {inv.invitedBy?.name} {timeAgo(inv.invitedAt)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={X} onClick={() => respond(inv, false)}>Decline</Button>
                <Button size="sm" icon={Check} onClick={() => respond(inv, true)}>Accept</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {list.loading && !list.data && <SkeletonGrid count={6} className="h-56" />}
          {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
          {list.data?.items.length === 0 && (
            <div className="card">
              <EmptyState
                icon={Users}
                title={tab === 'mine' ? "You haven't joined any groups" : 'No groups found'}
                description={tab === 'mine' ? 'Discover groups for your subjects or start your own.' : 'Try another search, or create the first group for this subject.'}
                action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Create group</Button>}
              />
            </div>
          )}
          {list.data?.items.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.data.items.map((g) => <GroupCard key={g._id} group={g} onJoin={join} joining={joining} />)}
            </div>
          )}
          <Pagination pagination={list.data?.pagination} onChange={setPage} />
        </>
      )}

      <GroupForm open={createOpen} onClose={() => setCreateOpen(false)} onSaved={(g) => navigate(`/groups/${g._id}`)} />
    </div>
  );
}
