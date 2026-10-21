'use client';

import useSWR from 'swr';
import clsx from 'clsx';
import { fetcher } from '@/lib/api';

export type FeedScope = 'all' | 'mine' | 'authored' | 'favorites';

export interface FeedFilterState {
  scope: FeedScope;
  type: string;
  countryId: string;
}

export interface ScopeOption {
  value: FeedScope;
  label: string;
}

/** Filtres du fil (section 8.3) : type de publication, pays, périmètre. */
const TYPES = [
  { value: '', label: 'Tout' },
  { value: 'NEWS', label: 'Nouvelles' },
  { value: 'URGENT_NEED', label: 'Besoins urgents' },
  { value: 'SPONSORSHIP_CALL', label: 'Appels au parrainage' },
  { value: 'VIDEO_PROGRESS', label: 'Progres' },
  { value: 'THANKS', label: 'Remerciements' },
];

export function FeedFilters({
  value,
  onChange,
  scopes = [],
}: {
  value: FeedFilterState;
  onChange: (v: FeedFilterState) => void;
  /** Périmètres proposés. Moins de deux : la ligne n’est pas affichée. */
  scopes?: ScopeOption[];
}) {
  const { data: countries } = useSWR<any[]>('/geo/countries', fetcher);

  return (
    <div className="sticky top-16 z-20 -mx-4 space-y-3 border-b border-ink-100 bg-ink-50/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:border-ink-200/70 sm:bg-white sm:px-4">
      {scopes.length > 1 && (
        <div className="flex rounded-xl bg-ink-100 p-1" role="tablist" aria-label="Périmètre du fil">
          {scopes.map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={value.scope === s.value}
              onClick={() => onChange({ ...value, scope: s.value })}
              className={clsx(
                'min-h-[40px] flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-fast',
                value.scope === s.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {(value.scope === 'all' || value.scope === 'mine') && (
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange({ ...value, type: t.value })}
            className={clsx(
              'inline-flex min-h-[40px] shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              value.type === t.value
                ? 'bg-risac-600 text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
            )}
          >
            {t.label}
          </button>
        ))}

        <select
          value={value.countryId}
          onChange={(e) => onChange({ ...value, countryId: e.target.value })}
          aria-label="Filtrer par pays"
          className="ml-auto shrink-0 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600"
        >
          <option value="">Tous les pays</option>
          {countries?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameFr}
            </option>
          ))}
        </select>
      </div>
      )}
    </div>
  );
}
