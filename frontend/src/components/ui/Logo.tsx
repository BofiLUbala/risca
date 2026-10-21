import clsx from 'clsx';

/**
 * Marque officielle RISAC (logo fourni par Congo Meilleur).
 * - showText : logo complet (toit, emblème et mot RISAC).
 * - sinon : emblème seul, pour les espaces étroits.
 * Le fichier a un fond blanc : il doit être posé sur une surface claire.
 * Dimensions fixées pour éviter tout décalage de mise en page au chargement.
 */
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  const alt = 'RISAC, Réseau International des Structures d’Accueil du Congo';

  return showText ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/risac-logo.png"
      alt={alt}
      width={574}
      height={369}
      className={clsx('h-11 w-auto select-none', className)}
      decoding="async"
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/risac-emblem.png"
      alt={alt}
      width={512}
      height={512}
      className={clsx('h-9 w-9 select-none', className)}
      decoding="async"
    />
  );
}
