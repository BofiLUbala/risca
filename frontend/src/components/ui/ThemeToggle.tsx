'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'risac.theme';

function apply(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

/**
 * Bascule clair / sombre. Le choix est mémorisé sur l'appareil ; sans choix, on suit
 * le réglage du système. Le script du `<head>` applique le thème avant l'affichage.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    apply(next);
    setDark(next);
    try {
      window.localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      /* stockage indisponible : le choix vaut pour cette page */
    }
  }

  const label = dark ? 'Passer en mode clair' : 'Passer en mode sombre';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={dark === null ? undefined : dark}
      className={`btn-ghost h-11 w-11 shrink-0 p-0 ${className}`}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
