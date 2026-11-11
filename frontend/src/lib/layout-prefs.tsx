'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

/**
 * Préférences d'affichage de l'espace connecté : couleur et côté du menu.
 * Les couleurs viennent du logo officiel (bleu marine, vert, bleu acier) ;
 * le choix est mémorisé dans le navigateur de la personne.
 */
export type SidebarColor = 'light' | 'navy' | 'green' | 'steel' | 'dark';
export type SidebarSide = 'left' | 'right';

export const SIDEBAR_COLORS: { value: SidebarColor; label: string; swatch: string }[] = [
  { value: 'light', label: 'Clair', swatch: '#ffffff' },
  { value: 'navy', label: 'Bleu RISAC', swatch: '#123f62' },
  { value: 'green', label: 'Vert', swatch: '#2d6a40' },
  { value: 'steel', label: 'Bleu acier', swatch: '#35697e' },
  { value: 'dark', label: 'Sombre', swatch: '#172430' },
];

interface Prefs {
  color: SidebarColor;
  side: SidebarSide;
}

const KEY = 'risac.layout.v1';
const DEFAULTS: Prefs = { color: 'navy', side: 'left' };

interface Ctx extends Prefs {
  setColor: (c: SidebarColor) => void;
  setSide: (s: SidebarSide) => void;
}

const LayoutPrefsContext = createContext<Ctx>({
  ...DEFAULTS,
  setColor: () => {},
  setSide: () => {},
});

function read(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw);
    return {
      color: SIDEBAR_COLORS.some((c) => c.value === p.color) ? p.color : DEFAULTS.color,
      side: p.side === 'right' ? 'right' : 'left',
    };
  } catch {
    return DEFAULTS;
  }
}

export function LayoutPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  // Lecture après le premier rendu pour rester identique au rendu serveur.
  useEffect(() => {
    setPrefs(read());
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible : le choix reste valable pour la session */
      }
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ...prefs,
      setColor: (color) => update({ color }),
      setSide: (side) => update({ side }),
    }),
    [prefs, update],
  );

  return <LayoutPrefsContext.Provider value={value}>{children}</LayoutPrefsContext.Provider>;
}

export function useLayoutPrefs() {
  return useContext(LayoutPrefsContext);
}
