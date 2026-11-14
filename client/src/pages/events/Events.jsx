import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { CalendarPlus, MapPin, Clock, Users, PartyPopper, CheckCircle2, EyeOff } from 'lucide-react';
import { eventApi } from '../../api';
import useAsync from '../../hooks/useAsync';
import useDebounce from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import { Badge, PageHeader, Pagination, SearchInput, Tabs } from '../../components/ui/Display';
import { EmptyState, ErrorState, SkeletonGrid } from '../../components/ui/Feedback';
import EventForm from '../../components/events/EventForm';
import { EVENT_CATEGORIES } from '../../utils/constants';
import { capitalize, fmtDate, fmtTime } from '../../utils/format';

const BANNER = {
  academic: 'from-brand-500 to-indigo-600', technical: 'from-sky-500 to-blue-600', cultural: 'from-pink-500 to-rose-600',
  sports: 'from-emerald-500 to-teal-600', workshop: 'from-amber-500 to-orange-600', seminar: 'from-violet-500 to-purple-600',
  career: 'from-indigo-500 to-brand-700', other: 'from-ink-500 to-ink-700',
};

export function EventCard({ event, onRegister, busy }) {
  const full = event.spotsLeft === 0;
  return (
    <article className={clsx('card flex flex-col overflow-hidden transition hover:shadow-pop', event.isPast && 'opacity-75')}>
      <Link to={`/events/${event._id}`} className={clsx('relative flex h-28 items-end bg-gradient-to-br p-4 text-white', BANNER[event.category])}>
        <div className="absolute right-4 top-4 rounded-xl bg-white/95 px-2.5 py-1.5 text-center text-ink-900 shadow">
          <p className="text-[10px] font-bold uppercase text-brand-600">{fmtDate(event.startDate, 'MMM')}</p>
          <p className="font-mono text-lg font-medium leading-none">{fmtDate(event.startDate, 'd')}</p>
        </div>
        <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">{capitalize(event.category)}</span>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/events/${event._id}`} className="line-clamp-2 font-bold hover:text-brand-600 dark:hover:text-brand-400">{event.title}</Link>
        <div className="muted mt-2 space-y-1 text-xs">
          <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {fmtDate(event.startDate, 'EEE, MMM d')} · {fmtTime(event.startDate)}</p>
          <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {event.venue}</p>
          <p className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {event.registrationsCount} registered
            {event.capacity > 0 && ` · ${event.spotsLeft} spot${event.spotsLeft === 1 ? '' : 's'} left`}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <div className="flex gap-1">
            {event.isRegistered && <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Registered</Badge>}
            {!event.isPublished && <Badge tone="gray"><EyeOff className="h-3 w-3" /> Draft</Badge>}
            {event.isPast && <Badge tone="gray">Ended</Badge>}
          </div>
          {onRegister && !event.isPast && !event.isRegistered && (
            <Button size="sm" disabled={!event.registrationOpen} loading={busy === event._id} onClick={() => onRegister(event)}>
              {full ? 'Full' : event.registrationOpen ? 'Register' : 'Closed'}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Events() {
  const { isAdmin } = useAuth();
  const [scope, setScope] = useState('upcoming');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const q = useDebounce(search);

  const list = useAsync(
    () => (scope === 'registered'
      ? eventApi.registered().then((items) => ({ items, pagination: null }))
      : eventApi.list({ scope, category: category || undefined, search: q || undefined, page, limit: 9 })),
    [scope, category, q, page]
  );

  const register = async (event) => {
    setBusy(event._id);
    try {
      const updated = await eventApi.register(event._id);
      toast.success(`You're registered for ${event.title}!`);
      list.setData((d) => ({ ...d, items: d.items.map((e) => (e._id === updated._id ? updated : e)) }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const items = list.data?.items || [];

  return (
    <div>
      <PageHeader
        eyebrow="Campus"
        title="Campus events"
        description="Hackathons, workshops, fests and seminars happening at your university."
        actions={isAdmin && <Button icon={CalendarPlus} onClick={() => setFormOpen(true)}>Create event</Button>}
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={scope}
          onChange={(v) => { setScope(v); setPage(1); }}
          tabs={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'registered', label: 'My registrations' }, { value: 'past', label: 'Past' }]}
        />
        {scope !== 'registered' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="select h-10 sm:w-44" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Category">
              <option value="">All categories</option>
              {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
            </select>
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search events…" className="sm:w-64" />
          </div>
        )}
      </div>

      {list.loading && !list.data && <SkeletonGrid count={6} className="h-72" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && items.length === 0 && (
        <div className="card">
          <EmptyState
            icon={PartyPopper}
            title={scope === 'registered' ? "You haven't registered for any events" : 'No events found'}
            description={scope === 'registered' ? 'Browse upcoming events and save your spot.' : 'Check back soon — new events are added regularly.'}
            action={scope === 'registered' && <Button onClick={() => setScope('upcoming')}>Browse events</Button>}
          />
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((e) => <EventCard key={e._id} event={e} onRegister={register} busy={busy} />)}
      </div>
      <Pagination pagination={list.data?.pagination} onChange={setPage} />

      {isAdmin && <EventForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => list.reload({ silent: true })} />}
    </div>
  );
}
