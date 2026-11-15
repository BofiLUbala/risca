'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Globe2, UserCog } from 'lucide-react';
import { continentOf, type Continent } from '@/lib/continents';
import { num } from '@/lib/format';

export type CountrySummary = { id: string; iso2: string; nameFr: string; count: number };
export type UsersByCountry = { countries: CountrySummary[]; withoutCountry: number };

/** Drapeau en émoji à partir du code ISO2 (simple repère visuel). */
const flag = (iso2: string) =>
  /^[A-Za-z]{2}$/.test(iso2) ? String.fromCodePoint(...iso2.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0))) : '';

/**
 * Utilisateurs regroupés par continent. Un clic sur un continent déroule ses pays avec leur effectif ; un clic sur un
 * pays ouvre la liste détaillée de ses utilisateurs (avec les actions du Super Admin, gérées par la page).
 */
export function CountryTree({ summary, onOpen }: { summary: UsersByCountry; onOpen: (id: string, label: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<Continent, CountrySummary[]>();
    for (const c of summary.countries) {
      const k = continentOf(c.iso2);
      map.set(k, [...(map.get(k) ?? []), c]);
    }
    return [...map.entries()]
      .map(([name, countries]) => ({ name, countries, total: countries.reduce((n, c) => n + c.count, 0) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'fr'));
  }, [summary]);

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const isOpen = open === g.name;
        return (
          <section key={g.name} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : g.name)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-risac-50/50 sm:px-5"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-risac-50 text-risac-700">
                <Globe2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-900">{g.name}</span>
                <span className="block text-xs text-ink-500">
                  {g.countries.length} pays · {num(g.total)} utilisateur{g.total > 1 ? 's' : ''}
                </span>
              </span>
              {isOpen ? <ChevronDown className="h-4 w-4 text-ink-400" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-ink-400" aria-hidden="true" />}
            </button>
            {isOpen && (
              <ul className="divide-y divide-ink-100 border-t border-ink-100">
                {g.countries.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(c.id, c.nameFr)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-risac-50/50 sm:px-5 sm:pl-[4.5rem]"
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        {flag(c.iso2)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{c.nameFr}</span>
                      <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-ink-700">{num(c.count)}</span>
                      <ChevronRight className="h-4 w-4 text-ink-300" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {summary.withoutCountry > 0 && (
        <section className="card overflow-hidden">
          <button
            type="button"
            onClick={() => onOpen('none', 'Administration (sans pays)')}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-risac-50/50 sm:px-5"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
              <UserCog className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink-900">Administration</span>
              <span className="block text-xs text-ink-500">Super Admin, finance, modération, audit : comptes sans pays</span>
            </span>
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-ink-700">{num(summary.withoutCountry)}</span>
            <ChevronRight className="h-4 w-4 text-ink-300" aria-hidden="true" />
          </button>
        </section>
      )}
    </div>
  );
}
