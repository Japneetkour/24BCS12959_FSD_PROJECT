import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Bookmark, Download, FileText, FileImage, FileArchive, Presentation, Sheet, Trash2, Users } from 'lucide-react';
import { resourceApi } from '../../api';
import { Avatar, Badge } from '../ui/Display';
import { RESOURCE_TYPES } from '../../utils/constants';
import { fmtBytes, timeAgo } from '../../utils/format';

export function FileIcon({ name = '', className = 'h-5 w-5' }) {
  const ext = name.split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg'].includes(ext)) return <FileImage className={className} />;
  if (['zip'].includes(ext)) return <FileArchive className={className} />;
  if (['ppt', 'pptx'].includes(ext)) return <Presentation className={className} />;
  if (['xls', 'xlsx'].includes(ext)) return <Sheet className={className} />;
  return <FileText className={className} />;
}

const EXT_TONE = { pdf: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300', ppt: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', pptx: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', doc: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', docx: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' };

export default function ResourceCard({ resource, onChange, onDelete, highlighted }) {
  const [downloading, setDownloading] = useState(false);
  const [bookmarked, setBookmarked] = useState(resource.isBookmarked);
  const ext = (resource.file?.originalName || '').split('.').pop().toLowerCase();
  const typeLabel = RESOURCE_TYPES.find((t) => t.value === resource.type)?.label || resource.type;

  const download = async () => {
    setDownloading(true);
    try {
      await resourceApi.download(resource);
      onChange?.({ ...resource, downloads: resource.downloads + 1 });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const toggleBookmark = async () => {
    setBookmarked((b) => !b);
    try {
      const { isBookmarked } = await resourceApi.bookmark(resource._id);
      setBookmarked(isBookmarked);
      toast.success(isBookmarked ? 'Saved to bookmarks' : 'Removed from bookmarks');
      onChange?.({ ...resource, isBookmarked, bookmarkCount: resource.bookmarkCount + (isBookmarked ? 1 : -1) });
    } catch (err) {
      setBookmarked((b) => !b);
      toast.error(err.message);
    }
  };

  return (
    <article className={clsx('card flex flex-col p-4 transition hover:shadow-pop', highlighted && 'ring-2 ring-brand-500')}>
      <div className="flex items-start gap-3">
        <span className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', EXT_TONE[ext] || 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300')}>
          <FileIcon name={resource.file?.originalName} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{resource.title}</h3>
          <p className="muted mt-0.5 truncate text-xs">{resource.subject} · Semester {resource.semester}</p>
        </div>
        <button
          type="button"
          onClick={toggleBookmark}
          className={clsx('btn btn-ghost btn-icon -mr-1 -mt-1', bookmarked && 'text-amber-500 hover:text-amber-600')}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          aria-pressed={bookmarked}
        >
          <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {resource.description && <p className="muted mt-3 line-clamp-2 text-xs">{resource.description}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="brand">{typeLabel}</Badge>
        <Badge tone="gray">{ext.toUpperCase()} · {fmtBytes(resource.file?.size)}</Badge>
        {resource.group && (
          <Badge tone="violet">
            <Users className="h-3 w-3" /> {resource.group.name || 'Group only'}
          </Badge>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 pt-3 dark:border-ink-800" style={{ marginTop: '1rem' }}>
        <div className="flex min-w-0 items-center gap-2">
          <Avatar user={resource.uploadedBy} size="xs" />
          <span className="muted truncate text-xs">
            {resource.uploadedBy?.name || 'Deleted user'} · {timeAgo(resource.createdAt)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {resource.canEdit && onDelete && (
            <button type="button" onClick={() => onDelete(resource)} className="btn btn-ghost btn-icon hover:text-rose-600" aria-label="Delete resource">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={download} disabled={downloading} className="btn btn-secondary btn-sm" title={`${resource.downloads} downloads`}>
            <Download className="h-3.5 w-3.5" /> {downloading ? '…' : resource.downloads}
          </button>
        </div>
      </div>
    </article>
  );
}
