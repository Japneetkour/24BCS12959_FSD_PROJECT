import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Textarea, Toggle, fieldErrors } from '../ui/Form';
import { groupApi } from '../../api';

export default function GroupForm({ open, onClose, group, onSaved }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      name: group?.name || '',
      subject: group?.subject || '',
      description: group?.description || '',
      isPrivate: group?.isPrivate || false,
      maxMembers: group?.maxMembers || 50,
      tags: (group?.tags || []).join(', '),
    });
  }, [open, group]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      ...form,
      maxMembers: Number(form.maxMembers),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
    };
    try {
      const saved = group ? await groupApi.update(group._id, body) : await groupApi.create(body);
      toast.success(group ? 'Group updated' : 'Study group created');
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
      title={group ? 'Group settings' : 'Create a study group'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="group-form" loading={saving}>{group ? 'Save' : 'Create group'}</Button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Group name" name="name" value={form.name || ''} onChange={set('name')} error={errors.name} placeholder="e.g. DSA Grinders" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Subject" name="subject" value={form.subject || ''} onChange={set('subject')} error={errors.subject} placeholder="e.g. Algorithms" />
          <Input label="Max members" name="maxMembers" type="number" min={2} max={200} value={form.maxMembers || ''} onChange={set('maxMembers')} error={errors.maxMembers} />
        </div>
        <Textarea label="Description" name="description" value={form.description || ''} onChange={set('description')} error={errors.description} rows={3} placeholder="What will the group study? When do you meet?" />
        <Input label="Tags" name="tags" value={form.tags || ''} onChange={set('tags')} placeholder="placements, dsa" />
        <Toggle
          checked={Boolean(form.isPrivate)}
          onChange={(v) => setForm((f) => ({ ...f, isPrivate: v }))}
          label="Private group"
          description="Hidden from discovery — people can only join with an invitation."
        />
      </form>
    </Modal>
  );
}
