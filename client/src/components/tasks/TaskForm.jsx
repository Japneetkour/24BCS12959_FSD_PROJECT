import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Textarea, fieldErrors } from '../ui/Form';
import { taskApi } from '../../api';
import { TASK_STATUSES } from '../../utils/constants';
import { fromLocalInput, toLocalInput } from '../../utils/format';

const EMPTY = { title: '', description: '', subject: '', type: 'task', priority: 'medium', status: 'todo', dueDate: '', reminderAt: '', tags: '' };

/** Create / edit task modal. Calls onSaved(task) after a successful save. */
export default function TaskForm({ open, onClose, task, onSaved, subjects = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      task
        ? {
            ...EMPTY,
            ...task,
            dueDate: toLocalInput(task.dueDate),
            reminderAt: toLocalInput(task.reminderAt),
            tags: (task.tags || []).join(', '),
          }
        : EMPTY
    );
  }, [open, task]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.reminderAt && form.dueDate && new Date(form.reminderAt) > new Date(form.dueDate)) {
      setErrors({ reminderAt: 'Reminder should be before the deadline' });
      return;
    }
    setSaving(true);
    setErrors({});
    const body = {
      title: form.title,
      description: form.description,
      subject: form.subject || 'General',
      type: form.type,
      priority: form.priority,
      status: form.status,
      dueDate: fromLocalInput(form.dueDate),
      reminderAt: fromLocalInput(form.reminderAt),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
    };
    try {
      const saved = task ? await taskApi.update(task._id, body) : await taskApi.create(body);
      toast.success(task ? 'Task updated' : 'Task created');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErrors({ ...fieldErrors(err), form: err.message });
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      description="Plan assignments and study tasks with deadlines and reminders."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="task-form" loading={saving}>{task ? 'Save changes' : 'Create task'}</Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input className="sm:col-span-2" label="Title" name="title" value={form.title} onChange={set('title')} error={errors.title} placeholder="e.g. DBMS Assignment 3" required />
        <div>
          <Input label="Subject" name="subject" list="task-subjects" value={form.subject} onChange={set('subject')} error={errors.subject} placeholder="e.g. Database Systems" />
          <datalist id="task-subjects">
            {subjects.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <Select label="Type" name="type" value={form.type} onChange={set('type')} options={[{ value: 'task', label: 'Task' }, { value: 'assignment', label: 'Assignment' }]} />
        <Select label="Priority" name="priority" value={form.priority} onChange={set('priority')} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} />
        <Select label="Status" name="status" value={form.status} onChange={set('status')} options={TASK_STATUSES} />
        <Input label="Deadline" name="dueDate" type="datetime-local" value={form.dueDate} onChange={set('dueDate')} error={errors.dueDate} />
        <Input label="Reminder" name="reminderAt" type="datetime-local" value={form.reminderAt} onChange={set('reminderAt')} error={errors.reminderAt} hint="You'll get a notification at this time." />
        <Textarea className="sm:col-span-2" label="Description" name="description" value={form.description} onChange={set('description')} error={errors.description} rows={3} />
        <Input className="sm:col-span-2" label="Tags" name="tags" value={form.tags} onChange={set('tags')} placeholder="comma, separated" />
      </form>
    </Modal>
  );
}
