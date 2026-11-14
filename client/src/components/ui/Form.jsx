import { forwardRef, useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

export function Field({ label, error, hint, htmlFor, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : (
        hint && <p className="muted mt-1 text-xs">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, className, id, name, ...props }, ref) {
  const inputId = id || name;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId} className={className}>
      <input ref={ref} id={inputId} name={name} className={clsx('input', error && 'input-error')} aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
});

export function PasswordInput({ label = 'Password', error, hint, className, id, name = 'password', ...props }) {
  const [show, setShow] = useState(false);
  const inputId = id || name;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId} className={className}>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={show ? 'text' : 'password'}
          className={clsx('input pr-10', error && 'input-error')}
          aria-invalid={Boolean(error)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

export function Select({ label, error, hint, className, id, name, options = [], placeholder, children, ...props }) {
  const selectId = id || name;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={selectId} className={className}>
      <select id={selectId} name={name} className={clsx('select', error && 'input-error')} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === 'object' ? (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ) : (
            <option key={o} value={o}>
              {o}
            </option>
          )
        )}
        {children}
      </select>
    </Field>
  );
}

export function Textarea({ label, error, hint, className, id, name, ...props }) {
  const tId = id || name;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={tId} className={className}>
      <textarea id={tId} name={name} className={clsx('textarea', error && 'input-error')} {...props} />
    </Field>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold text-ink-800 dark:text-ink-100">{label}</span>
        {description && <span className="muted block text-xs">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700'
        )}
      >
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

/** Maps a 422 API error ({ errors:[{field,message}] }) into { field: message }. */
export const fieldErrors = (err) =>
  (err?.errors || []).reduce((acc, e) => ({ ...acc, [e.field]: acc[e.field] || e.message }), {});
