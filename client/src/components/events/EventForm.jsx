import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Textarea, Toggle, fieldErrors } from '../ui/Form';
import { eventApi } from '../../api';
import { EVENT_CATEGORIES } from '../../utils/constants';
import { capitalize, fromLocalInput, toLocalInput } from '../../utils/format';

/** Admin-only: create / edit an event. */
export default function EventForm({ open, onClose, event, onSaved }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      title: event?.title || '',
      description: event?.description || '',
      category: event?.category || 'academic',
      venue: event?.venue || '',
      organizer: event?.organizer || '',
      startDate: toLocalInput(event?.startDate),
      endDate: toLocalInput(event?.endDate),
      registrationDeadline: toLocalInput(event?.registrationDeadline),
      capacity: event?.capacity ?? 0,
      isPublished: event?.isPublished ?? true,
    });
  }, [open, event]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (!form.startDate) local.startDate = 'Start date is required';
    if (!form.endDate) local.endDate = 'End date is required';
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) local.endDate = 'End must be after start';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setSaving(true);
    setErrors({});
    const body = {
      ...form,
      capacity: Number(form.capacity) || 0,
      startDate: fromLocalInput(form.startDate),
      endDate: fromLocalInput(form.endDate),
      registrationDeadline: fromLocalInput(form.registrationDeadline),
    };
    if (!body.organizer) delete body.organizer;
    try {
      const saved = event ? await eventApi.update(event._id, body) : await eventApi.create(body);
      toast.success(event ? 'Event updated' : 'Event published — students have been notified');
      onSaved?.(saved);
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
      title={event ? 'Edit event' : 'Create event'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="event-form" loading={saving}>{event ? 'Save changes' : 'Create event'}</Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input className="sm:col-span-2" label="Title" name="title" value={form.title || ''} onChange={set('title')} error={errors.title} />
        <Select label="Category" name="category" value={form.category} onChange={set('category')} options={EVENT_CATEGORIES.map((c) => ({ value: c, label: capitalize(c) }))} />
        <Input label="Organizer" name="organizer" value={form.organizer || ''} onChange={set('organizer')} placeholder="e.g. Coding Club" />
        <Input className="sm:col-span-2" label="Venue" name="venue" value={form.venue || ''} onChange={set('venue')} error={errors.venue} />
        <Input label="Starts" name="startDate" type="datetime-local" value={form.startDate || ''} onChange={set('startDate')} error={errors.startDate} />
        <Input label="Ends" name="endDate" type="datetime-local" value={form.endDate || ''} onChange={set('endDate')} error={errors.endDate} />
        <Input label="Registration closes" name="registrationDeadline" type="datetime-local" value={form.registrationDeadline || ''} onChange={set('registrationDeadline')} error={errors.registrationDeadline} hint="Optional" />
        <Input label="Capacity" name="capacity" type="number" min={0} value={form.capacity} onChange={set('capacity')} error={errors.capacity} hint="0 = unlimited" />
        <Textarea className="sm:col-span-2" label="Description" name="description" rows={5} value={form.description || ''} onChange={set('description')} error={errors.description} />
        <div className="sm:col-span-2">
          <Toggle checked={Boolean(form.isPublished)} onChange={(v) => setForm((f) => ({ ...f, isPublished: v }))} label="Published" description="Unpublished events are only visible to administrators." />
        </div>
      </form>
    </Modal>
  );
}
