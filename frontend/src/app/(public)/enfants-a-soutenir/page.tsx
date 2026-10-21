'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Users } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { ChildCard, type PublicChild } from '@/components/ChildCard';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';

export default function PublicChildrenPage() {
  const [warOrphan, setWarOrphan] = useState(false);
  const [needsSponsor, setNeedsSponsor] = useState(false);
  const [maxAge, setMaxAge] = useState('');
  const [countryId, setCountryId] = useState('');

  const { data: countries } = useSWR<any[]>('/geo/countries', fetcher);

  const params = new URLSearchParams({ take: '60' });
  if (warOrphan) params.set('warOrphan', 'true');
  if (needsSponsor) params.set('needsSponsor', 'true');
  if (maxAge) params.set('maxAge', maxAge);
  if (countryId) params.set('countryId', countryId);

  const { data, isLoading } = useSWR<PublicChild[]>(
    `/children/public/feed?${params.toString()}`,
    fetcher,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
          Enfants &agrave; soutenir
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
          Pr&eacute;nom, &acirc;ge et r&eacute;gion g&eacute;n&eacute;rale uniquement. Le nom de
          famille, la localisation pr&eacute;cise et les donn&eacute;es de sant&eacute; ne sont jamais
          publics.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-ink-200/70 bg-white p-4">
        <select
          value={countryId}
          onChange={(e) => setCountryId(e.target.value)}
          className="input sm:w-56"
          aria-label="Pays"
        >
          <option value="">Tous les pays</option>
          {countries?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameFr}
            </option>
          ))}
        </select>

        <select value={maxAge} onChange={(e) => setMaxAge(e.target.value)} className="input sm:w-48" aria-label="Age">
          <option value="">Tous les ages</option>
          <option value="6">Moins de 6 ans</option>
          <option value="12">Moins de 12 ans</option>
          <option value="18">Moins de 18 ans</option>
        </select>

        <label className="flex items-center gap-2 rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={warOrphan}
            onChange={(e) => setWarOrphan(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-risac-600"
          />
          Orphelins de guerre
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={needsSponsor}
            onChange={(e) => setNeedsSponsor(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-risac-600"
          />
          Sans parrain
        </label>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <SkeletonList rows={3} />
        ) : !data?.length ? (
          <Empty icon={<Users className="h-6 w-6" />} title="Aucun enfant ne correspond a ces filtres" />
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-500">{data.length} profil(s)</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.map((c) => (
                <ChildCard key={c.id} child={c} headingLevel="h2" />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
