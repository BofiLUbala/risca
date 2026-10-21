'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AlertTriangle, CakeSlice, ChevronDown } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { SkeletonList } from '@/components/ui/Loading';
import { date } from '@/lib/format';

function age(birthDate?: string | null): string {
  if (!birthDate) return 'âge inconnu';
  const years = (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600000);
  return `${Math.floor(years)} ans`;
}

/**
 * Alertes de suivi du périmètre : visites et bulletins en retard
 * (`GET /children/alerts/overdue`) et enfants approchant la majorité
 * (`GET /children/alerts/nearing-adulthood`). Replié par défaut pour ne pas
 * charger la liste des dossiers.
 */
export function FollowUpAlerts() {
  const [open, setOpen] = useState(false);
  const { data: overdue, isLoading: loadingOverdue } = useSWR<any[]>(
    open ? '/children/alerts/overdue' : null,
    fetcher,
  );
  const { data: adults, isLoading: loadingAdults } = useSWR<any[]>(
    open ? '/children/alerts/nearing-adulthood' : null,
    fetcher,
  );

  const total = (overdue?.length ?? 0) + (adults?.length ?? 0);

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-fast hover:bg-ink-50 sm:px-5"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <span className="flex-1 section-title">Alertes de suivi</span>
        {open && !loadingOverdue && !loadingAdults && (
          <span className="chip bg-amber-50 text-amber-800">{total}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform duration-fast ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="animate-fade-up space-y-5 border-t border-ink-100 px-4 py-4 sm:px-5">
          <div>
            <h3 className="card-title">Visites et bulletins en retard</h3>
            {loadingOverdue ? (
              <SkeletonList rows={2} />
            ) : !overdue?.length ? (
              <p className="meta mt-1">Aucun retard de suivi dans votre périmètre.</p>
            ) : (
              <ul className="mt-2 divide-y divide-ink-100">
                {overdue.map((a, i) => (
                  <li key={`${a.childId}-${a.kind}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <Link href={`/enfants/${a.childId}`} className="text-sm font-medium text-risac-700 hover:underline">
                      {a.firstName} · {a.publicId}
                    </Link>
                    <span className="chip bg-amber-50 text-amber-800">
                      {a.kind === 'VISIT_OVERDUE' ? 'Visite' : 'Bulletin'}
                    </span>
                    <span className="meta w-full sm:w-auto sm:flex-1">{a.message}</span>
                    <span className="meta">{a.orphanage}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="card-title flex items-center gap-2">
              <CakeSlice className="h-4 w-4 text-steel-600" aria-hidden />
              Approchent la majorité
            </h3>
            {loadingAdults ? (
              <SkeletonList rows={2} />
            ) : !adults?.length ? (
              <p className="meta mt-1">Aucun enfant de plus de 16 ans dans votre périmètre.</p>
            ) : (
              <ul className="mt-2 divide-y divide-ink-100">
                {adults.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <Link href={`/enfants/${c.id}`} className="text-sm font-medium text-risac-700 hover:underline">
                      {c.firstName} · {c.publicId}
                    </Link>
                    <span className="meta">{age(c.birthDate)}</span>
                    <span className="meta sm:flex-1">{c.orphanage?.name}</span>
                    <span
                      className={`chip ${
                        c.postMajorityPrepared ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {c.postMajorityPrepared ? 'Sortie préparée' : 'Sortie à préparer'}
                    </span>
                    {c.birthDate && <span className="meta">Né le {date(c.birthDate)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
