import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, Building2, Pencil, Trash2, Download, CheckCircle2, Timer } from 'lucide-react';
import { eventApi } from '../../api';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Avatar, Pagination, ProgressBar } from '../../components/ui/Display';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/Feedback';
import { PageLoader } from '../../components/ui/Spinner';
import EventForm from '../../components/events/EventForm';
import { capitalize, fmtDate, fmtDateTime, fmtTime, timeAgo } from '../../utils/format';

function Participants({ eventId, total }) {
  const [page, setPage] = useState(1);
  const list = useAsync(() => eventApi.participants(eventId, { page, limit: 20 }), [eventId, page, total]);

  const exportCsv = async () => {
    try {
      const all = await eventApi.participants(eventId, { limit: 500 });
      const rows = [['Name', 'Email', 'Department', 'Semester', 'Roll number', 'Registered at']];
      all.items.forEach((p) => rows.push([p.name, p.email, p.department, p.semester, p.rollNumber || '', new Date(p.registeredAt).toISOString()]));
      const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section className="card mt-6">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-ink-800">
        <div>
          <h2 className="section-title">Registered participants</h2>
          <p className="muted text-xs">Visible to administrators only</p>
        </div>
        <Button size="sm" variant="secondary" icon={Download} onClick={exportCsv} disabled={!total}>Export CSV</Button>
      </div>
      <div className="p-3">
        {list.loading && !list.data && <SkeletonList rows={3} className="p-2" />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data?.items.length === 0 && <EmptyState icon={Users} title="No registrations yet" />}
        {list.data?.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 font-semibold">Department</th>
                  <th className="px-3 py-2 font-semibold">Roll no.</th>
                  <th className="px-3 py-2 font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {list.data.items.map((p) => (
                  <tr key={p._id}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar user={p} size="sm" />
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="muted text-xs">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{p.department} · Sem {p.semester}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{p.rollNumber || '—'}</td>
                    <td className="muted px-3 py-2.5 text-xs">{timeAgo(p.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-3"><Pagination pagination={list.data?.pagination} onChange={setPage} /></div>
      </div>
    </section>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: event, loading, error, reload, setData } = useAsync(() => eventApi.get(id), [id]);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'delete' | 'cancel'

  if (loading && !event) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const register = async () => {
    setBusy(true);
    try {
      setData(await eventApi.register(id));
      toast.success("You're registered! We'll remind you a day before.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async () => {
    setBusy(true);
    try {
      if (confirm === 'delete') {
        await eventApi.remove(id);
        toast.success('Event deleted — registered students were notified');
        navigate('/events');
        return;
      }
      setData(await eventApi.unregister(id));
      toast.success('Registration cancelled');
      setConfirm(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fill = event.capacity > 0 ? Math.round((event.registrationsCount / event.capacity) * 100) : null;

  return (
    <div>
      <Link to="/events" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <article className="card overflow-hidden">
          <div className="bg-gradient-to-br from-brand-600 to-violet-700 p-8 text-white">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{capitalize(event.category)}</span>
              {!event.isPublished && <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">Draft</span>}
              {event.isPast && <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">Ended</span>}
            </div>
            <h1 className="mt-4 text-3xl font-extrabold text-white">{event.title}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/80"><Building2 className="h-4 w-4" /> Organised by {event.organizer}</p>
          </div>
          <div className="p-6">
            <h2 className="section-title mb-2">About this event</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700 dark:text-ink-300">{event.description}</p>
          </div>
        </article>

        <aside className="space-y-4">
          <div className="card card-pad space-y-4">
            {[
              { icon: CalendarDays, label: 'Date', value: fmtDate(event.startDate, 'EEEE, MMMM d, yyyy') },
              { icon: Clock, label: 'Time', value: `${fmtTime(event.startDate)} – ${new Date(event.endDate).toDateString() === new Date(event.startDate).toDateString() ? fmtTime(event.endDate) : fmtDateTime(event.endDate)}` },
              { icon: MapPin, label: 'Venue', value: event.venue },
              ...(event.registrationDeadline ? [{ icon: Timer, label: 'Registration closes', value: fmtDateTime(event.registrationDeadline) }] : []),
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300"><Icon className="h-4 w-4" /></span>
                <div>
                  <p className="muted text-[11px] font-semibold uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              </div>
            ))}

            <div className="border-t border-ink-100 pt-4 dark:border-ink-800">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold">{event.registrationsCount} registered</span>
                <span className="muted text-xs">{event.capacity > 0 ? `${event.spotsLeft} of ${event.capacity} spots left` : 'Unlimited spots'}</span>
              </div>
              {fill !== null && <ProgressBar value={fill} tone={fill >= 90 ? 'red' : fill >= 70 ? 'amber' : 'brand'} />}
            </div>

            {event.isRegistered ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> You're registered
                </div>
                {!event.isPast && <Button variant="secondary" className="w-full" onClick={() => setConfirm('cancel')}>Cancel registration</Button>}
              </div>
            ) : (
              !event.isPast && (
                <Button className="w-full" onClick={register} loading={busy} disabled={!event.registrationOpen}>
                  {event.registrationOpen ? 'Register now' : event.spotsLeft === 0 ? 'Event is full' : 'Registration closed'}
                </Button>
              )
            )}
          </div>

          {isAdmin && (
            <div className="card card-pad flex gap-2">
              <Button variant="secondary" className="flex-1" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>
              <Button variant="danger" className="flex-1" icon={Trash2} onClick={() => setConfirm('delete')}>Delete</Button>
            </div>
          )}
        </aside>
      </div>

      {isAdmin && <Participants eventId={id} total={event.registrationsCount} />}

      {isAdmin && <EventForm open={editOpen} onClose={() => setEditOpen(false)} event={event} onSaved={(e) => setData(e)} />}
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={confirmAction}
        loading={busy}
        title={confirm === 'delete' ? 'Delete this event?' : 'Cancel your registration?'}
        confirmLabel={confirm === 'delete' ? 'Delete event' : 'Cancel registration'}
        message={confirm === 'delete' ? `All ${event.registrationsCount} registrations will be removed and students notified.` : 'Your spot will be released to other students.'}
      />
    </div>
  );
}
