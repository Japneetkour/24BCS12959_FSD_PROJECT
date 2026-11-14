import clsx from 'clsx';
import { Check, Clock, Pencil, Trash2, BellRing, Sparkles } from 'lucide-react';
import { Badge } from '../ui/Display';
import { PRIORITY_TONE, STATUS_TONE } from '../../utils/constants';
import { capitalize, dueLabel } from '../../utils/format';

const SMART_TONE = { 'Do now': 'red', 'Do next': 'amber', Plan: 'brand', Later: 'gray' };

export default function TaskItem({ task, onToggle, onEdit, onDelete, compact = false }) {
  const done = task.status === 'completed';
  const overdue = task.isOverdue || (!done && task.dueDate && new Date(task.dueDate) < new Date());

  return (
    <div className={clsx('group flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-ink-50 dark:hover:bg-ink-850', done && 'opacity-60')}>
      <button
        type="button"
        onClick={() => onToggle?.(task)}
        aria-label={done ? 'Mark as not completed' : 'Mark as completed'}
        className={clsx(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition',
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300 hover:border-brand-500 dark:border-ink-600'
        )}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={clsx('text-sm font-semibold', done && 'line-through')}>{task.title}</p>
          {task.type === 'assignment' && <Badge tone="violet">Assignment</Badge>}
          {task.smart && !done && (
            <Badge tone={SMART_TONE[task.smart.label]}>
              <Sparkles className="h-3 w-3" /> {task.smart.label}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
          <span className="font-medium">{task.subject}</span>
          <span className={clsx('flex items-center gap-1', overdue && 'font-semibold text-rose-600 dark:text-rose-400')}>
            <Clock className="h-3 w-3" /> {dueLabel(task.dueDate, done)}
          </span>
          {task.reminderAt && !task.reminderSent && !done && (
            <span className="flex items-center gap-1" title="Reminder set">
              <BellRing className="h-3 w-3" />
            </span>
          )}
          {task.smart && !done && !compact && <span className="hidden sm:inline">· {task.smart.reason}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!compact && task.status !== 'todo' && <Badge tone={STATUS_TONE[task.status]}>{capitalize(task.status)}</Badge>}
        <Badge tone={PRIORITY_TONE[task.priority]} dot>
          {capitalize(task.priority)}
        </Badge>
        {(onEdit || onDelete) && (
          <div className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            {onEdit && (
              <button type="button" onClick={() => onEdit(task)} className="btn btn-ghost btn-icon" aria-label="Edit task">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={() => onDelete(task)} className="btn btn-ghost btn-icon hover:text-rose-600" aria-label="Delete task">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
