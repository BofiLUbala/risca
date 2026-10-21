'use client';

import { useState } from 'react';
import clsx from 'clsx';

/**
 * Image qui disparait proprement si le fichier est absent,
 * au lieu d afficher l icone d image cassee du navigateur.
 */
export function SafeImage({
  src,
  alt = '',
  className,
  fallback = null,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className={clsx('bg-ink-100', className)}
    />
  );
}
