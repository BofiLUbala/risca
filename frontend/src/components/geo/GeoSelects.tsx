'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { t, geoName } from '@/lib/i18n';

export interface GeoCountry {
  id: string;
  iso2: string;
  nameFr: string;
  _count?: { provinces: number };
}

/** Drapeau en image auto-hebergee (les emojis de drapeau ne s'affichent pas sous Windows). */
export function FlagImg({ iso2, name, className = '' }: { iso2: string; name?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={`grid h-[15px] w-5 shrink-0 place-items-center rounded-[2px] bg-ink-100 text-[8px] font-semibold text-ink-600 ${className}`}
      >
        {iso2.toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/svg/${iso2.toLowerCase()}.svg`}
      width={20}
      height={15}
      alt={name ? t("Drapeau : {name}", { name }) : ''}
      loading="lazy"
      className={`h-[15px] w-5 shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(23,36,48,0.15)] ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

/** Liste de tous les pays du monde (cache SWR partage par tous les formulaires). */
export function useCountries() {
  return useSWR<GeoCountry[]>('/geo/countries', fetcher, { revalidateOnFocus: false });
}

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Selecteur de pays avec drapeau et recherche. Valeur = id du pays ('' = aucun).
 * Les pays viennent de /geo/countries (ISO 3166-1, monde entier).
 */
export function CountrySelect({
  value,
  onChange,
  id,
  placeholder = t("Choisir un pays"),
  allLabel,
  className = '',
  disabled = false,
}: {
  value: string;
  onChange: (id: string, country?: GeoCountry) => void;
  id?: string;
  placeholder?: string;
  /** Si fourni, ajoute une entree "tous" (ex. filtres). */
  allLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { data: countries, isLoading } = useCountries();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const listId = `${autoId}-list`;

  const selected = countries?.find((c) => c.id === value);
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!countries) return [];
    return q ? countries.filter((c) => norm(c.nameFr).includes(q) || c.iso2.toLowerCase() === q) : countries;
  }, [countries, query]);

  const options: Array<GeoCountry | null> = useMemo(
    () => (allLabel && !query ? [null, ...filtered] : filtered),
    [allLabel, query, filtered],
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      const idx = Math.max(
        0,
        options.findIndex((o) => (o ? o.id === value : value === '')),
      );
      setActive(idx);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function pick(o: GeoCountry | null) {
    onChange(o ? o.id : '', o ?? undefined);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options.length) pick(options[active] ?? null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="input flex w-full items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        {selected ? (
          <>
            <FlagImg iso2={selected.iso2} name={geoName(selected)} />
            <span className="min-w-0 flex-1 truncate">{geoName(selected)}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ink-500">
            {value === '' && allLabel ? allLabel : isLoading ? t("Chargement…") : placeholder}
          </span>
        )}
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-500" fill="currentColor" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5-1-1L10 10 6.5 6.5z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg">
          <div className="border-b border-ink-100 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder={t("Rechercher un pays…")}
              aria-label={t("Rechercher un pays")}
              aria-controls={listId}
              className="input h-9 w-full text-sm"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 && <li className="px-3 py-2 text-sm text-ink-500">{t("Aucun pays trouvé")}</li>}
            {options.map((o, i) => {
              const isSel = o ? o.id === value : value === '';
              return (
                <li
                  key={o ? o.id : '__all'}
                  role="option"
                  aria-selected={isSel}
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
                    i === active ? 'bg-ink-50' : ''
                  } ${isSel ? 'font-semibold text-ink-900' : 'text-ink-700'}`}
                >
                  {o ? (
                    <>
                      <FlagImg iso2={o.iso2} name={geoName(o)} />
                      <span className="truncate">{geoName(o)}</span>
                    </>
                  ) : (
                    <span>{allLabel}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Selecteur de province / region : se remplit tout seul des que le pays est choisi.
 * Valeur = id de la province ('' = aucune).
 */
export function ProvinceSelect({
  countryId,
  value,
  onChange,
  id,
  allLabel,
  className = 'input',
  required,
}: {
  countryId: string;
  value: string;
  onChange: (id: string) => void;
  id?: string;
  allLabel?: string;
  className?: string;
  required?: boolean;
}) {
  const { data: provinces, isLoading } = useSWR<Array<{ id: string; nameFr: string; riskZone?: boolean }>>(
    countryId ? `/geo/countries/${countryId}/provinces` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const none = !!countryId && !isLoading && provinces?.length === 0;
  const first = !countryId
    ? t("Choisissez d’abord un pays")
    : isLoading
      ? t("Chargement…")
      : none
        ? t("Aucune subdivision")
        : (allLabel ?? t("Choisir une province"));

  return (
    <select
      id={id}
      value={value}
      required={required && !none}
      disabled={!countryId || isLoading || none}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">{first}</option>
      {provinces?.map((p) => (
        <option key={p.id} value={p.id}>
          {geoName(p)}
          {p.riskZone ? t(" (zone à risque)") : ''}
        </option>
      ))}
    </select>
  );
}
