import clsx from 'clsx';
import Spinner from './Spinner';

const VARIANTS = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' };

export default function Button({
  variant = 'primary', size, loading = false, icon: Icon, className, children, disabled, type = 'button', ...props
}) {
  return (
    <button
      type={type}
      className={clsx('btn', VARIANTS[variant], size === 'sm' && 'btn-sm', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...props }) {
  return (
    <button type="button" aria-label={label} title={label} className={clsx('btn btn-ghost btn-icon', className)} {...props}>
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
