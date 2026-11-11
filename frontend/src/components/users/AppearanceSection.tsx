'use client';

import clsx from 'clsx';
import { Check, PanelLeft, PanelRight } from 'lucide-react';
import { SIDEBAR_COLORS, useLayoutPrefs } from '@/lib/layout-prefs';

/** Choix de la couleur et du côté du menu latéral, mémorisé sur cet appareil. */
export function AppearanceSection() {
  const { color, side, setColor, setSide } = useLayoutPrefs();

  return (
    <section className="card card-pad">
      <h2 className="section-title">Apparence</h2>
      <p className="meta mt-1">Le choix est enregistré sur cet appareil et s&apos;applique tout de suite.</p>

      <fieldset className="mt-5">
        <legend className="label">Couleur du menu</legend>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Couleur du menu">
          {SIDEBAR_COLORS.map((c) => {
            const selected = color === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setColor(c.value)}
                className={clsx(
                  'flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  selected ? 'border-risac-700 bg-risac-50 text-risac-900' : 'border-ink-200 text-ink-700 hover:bg-ink-50',
                )}
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-full border border-ink-300"
                  style={{ background: c.swatch }}
                >
                  {selected && <Check className={clsx('h-3.5 w-3.5', c.value === 'light' ? 'text-ink-900' : 'text-white')} />}
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">Position du menu</legend>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Position du menu">
          {(
            [
              { value: 'left', label: 'À gauche', Icon: PanelLeft },
              { value: 'right', label: 'À droite', Icon: PanelRight },
            ] as const
          ).map(({ value, label, Icon }) => {
            const selected = side === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSide(value)}
                className={clsx(
                  'flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  selected ? 'border-risac-700 bg-risac-50 text-risac-900' : 'border-ink-200 text-ink-700 hover:bg-ink-50',
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
