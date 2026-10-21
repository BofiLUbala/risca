import clsx from 'clsx';

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'primary' | 'mint' | 'amber' | 'coral';
  className?: string;
}) {
  const tones = {
    default: 'bg-ink-100 text-ink-600',
    primary: 'bg-risac-50 text-risac-600',
    mint: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    coral: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className={clsx('card card-pad', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug text-ink-500">{label}</p>
          <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
        </div>
        {icon && (
          <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
