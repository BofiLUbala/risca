'use client';

import clsx from 'clsx';
import { Locale, LOCALES, t, useI18n } from '@/lib/i18n';

/** Sélecteur de langue FR / EN : mémorisé sur l'appareil, français par défaut. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div
      role="group"
      aria-label={t('Langue de l’interface')}
      className={clsx('flex h-9 shrink-0 items-center rounded-lg border border-ink-100 bg-surface p-0.5 text-xs font-semibold', className)}
    >
      {LOCALES.map((l: Locale) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => l !== locale && setLocale(l)}
          aria-pressed={l === locale}
          title={l === 'fr' ? 'Français' : 'English'}
          className={clsx(
            'h-full min-w-[34px] rounded-md px-2 uppercase transition-colors',
            l === locale ? 'bg-ink-900 text-surface dark:bg-sun-400 dark:text-ink-950' : 'text-ink-600 hover:bg-ink-50',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
