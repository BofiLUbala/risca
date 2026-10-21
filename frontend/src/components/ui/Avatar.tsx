import clsx from 'clsx';
import { SafeImage } from '@/components/ui/SafeImage';
import { initials } from '@/lib/format';
import { mediaUrl } from '@/lib/api';

export function Avatar({
  src,
  firstName,
  lastName,
  size = 'md',
  className,
}: {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-lg',
    xl: 'h-24 w-24 text-2xl',
  };
  const url = mediaUrl(src);

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-gradient-to-br from-risac-200 to-risac-400 font-semibold text-white',
        sizes[size],
        className,
      )}
    >
      <SafeImage
        src={url}
        className="h-full w-full object-cover"
        fallback={initials(firstName, lastName)}
      />
    </span>
  );
}
