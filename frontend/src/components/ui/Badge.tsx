import clsx from 'clsx';
import { label, statusTone } from '@/lib/roles';

export function Badge({
  status,
  children,
  tone,
  className,
}: {
  status?: string;
  children?: React.ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span className={clsx('chip', tone ?? statusTone(status), className)}>
      {children ?? label(status)}
    </span>
  );
}
