import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { UploadCloud, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Textarea, fieldErrors } from '../ui/Form';
import { resourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { ACCEPTED_FILES, RESOURCE_TYPES, SEMESTERS } from '../../utils/constants';
import { fmtBytes } from '../../utils/format';
import { FileIcon } from './ResourceCard';

const MAX_MB = 15;

/** Upload a study resource. Pass `group` to share it only with a study group. */
export default function UploadModal({ open, onClose, onUploaded, group, subjects = [] }) {
  const { user } = useAuth();
  const empty = { title: '', description: '', subject: group?.subject || '', semester: user?.semester || 1, type: 'notes', tags: '' };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setFile(null);
      setErrors({});
      setProgress(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickFile = (f) => {
    if (!f) return;
    const ext = `.${f.name.split('.').pop().toLowerCase()}`;
    if (!ACCEPTED_FILES.split(',').includes(ext)) {
      setErrors((e) => ({ ...e, file: `Unsupported file type (${ext}).` }));
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErrors((e) => ({ ...e, file: `File is larger than ${MAX_MB} MB.` }));
      return;
    }
    setErrors((e) => ({ ...e, file: undefined }));
    setFile(f);
    if (!form.title) setForm((x) => ({ ...x, title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrors({ file: 'Please choose a file to upload.' });
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (group) fd.append('group', group._id);
    fd.append('file', file);
    setProgress(0);
    try {
      const resource = await resourceApi.upload(fd, (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)));
      toast.success('Resource uploaded');
      onUploaded?.(resource);
      onClose();
    } catch (err) {
      setErrors({ ...fieldErrors(err), form: err.message });
      toast.error(err.message);
      setProgress(null);
    }
  };

  const uploading = progress !== null;

  return (
    <Modal
      open={open}
      onClose={uploading ? undefined : onClose}
      title={group ? `Share a file with ${group.name}` : 'Upload study material'}
      description={group ? 'Only group members will be able to see and download it.' : 'Share notes, slides and papers with everyone on campus.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button type="submit" form="upload-form" loading={uploading} icon={UploadCloud}>
            {uploading ? `Uploading ${progress}%` : 'Upload'}
          </Button>
        </>
      }
    >
      <form id="upload-form" onSubmit={submit} className="space-y-4" noValidate>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={clsx(
            'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition',
            dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-ink-200 hover:border-brand-400 dark:border-ink-700',
            errors.file && 'border-rose-400'
          )}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={(e) => pickFile(e.target.files[0])} />
          {file ? (
            <div className="flex w-full items-center gap-3 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <FileIcon name={file.name} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{file.name}</span>
                <span className="muted text-xs">{fmtBytes(file.size)}</span>
              </span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="btn btn-ghost btn-icon" aria-label="Remove file">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-brand-500" />
              <p className="mt-2 text-sm font-semibold">Drop a file here or click to browse</p>
              <p className="muted mt-1 text-xs">PDF, Word, PowerPoint, Excel, text, ZIP or images · max {MAX_MB} MB</p>
            </>
          )}
        </div>
        {errors.file && <p className="-mt-2 text-xs font-medium text-rose-600">{errors.file}</p>}
        {uploading && (
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <Input label="Title" name="title" value={form.title} onChange={set('title')} error={errors.title} required />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Input label="Subject" name="subject" list="resource-subjects" value={form.subject} onChange={set('subject')} error={errors.subject} required />
            <datalist id="resource-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <Select label="Semester" name="semester" value={form.semester} onChange={set('semester')} options={SEMESTERS.map((s) => ({ value: s, label: `Semester ${s}` }))} error={errors.semester} />
          <Select label="Type" name="type" value={form.type} onChange={set('type')} options={RESOURCE_TYPES} />
        </div>
        <Textarea label="Description" name="description" value={form.description} onChange={set('description')} rows={2} error={errors.description} />
        <Input label="Tags" name="tags" value={form.tags} onChange={set('tags')} placeholder="comma, separated" />
      </form>
    </Modal>
  );
}
