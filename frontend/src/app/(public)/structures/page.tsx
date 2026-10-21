'use client';

import useSWR from 'swr';
import { SafeImage } from '@/components/ui/SafeImage';
import { Building2, MapPin, Users } from 'lucide-react';
import { fetcher, mediaUrl } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { num } from '@/lib/format';

export default function PublicOrphanagesPage() {
  const { data, isLoading } = useSWR<any[]>('/orphanages/public', fetcher);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
          Structures d&apos;accueil
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
          Seul un orphelinat labellis&eacute; peut recevoir des fonds. La localisation exacte est
          masqu&eacute;e en zone &agrave; risque.
        </p>
      </header>

      <div className="mt-8">
        {isLoading ? (
          <SkeletonList rows={3} />
        ) : !data?.length ? (
          <Empty icon={<Building2 className="h-6 w-6" />} title="Aucune structure publiée" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((o) => (
              <article key={o.id} className="card overflow-hidden">
                <div className="aspect-[16/9] bg-gradient-to-br from-risac-100 to-risac-300">
                  <SafeImage src={mediaUrl(o.logoUrl)} className="h-full w-full object-cover" />
                </div>
                <div className="card-pad">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="section-title">{o.name}</h2>
                    <Badge status={o.labelStatus} />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                    <MapPin className="h-3.5 w-3.5" />
                    {o.city ? `${o.city}, ` : ''}
                    {o.province.nameFr} &middot; {o.country.nameFr}
                  </p>
                  {o.description && (
                    <p className="mt-3 line-clamp-3 text-sm text-ink-600">{o.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {num(o._count.children)} enfants
                    </span>
                    <span>
                      {num(o.occupiedPlaces)} / {num(o.totalPlaces)} places
                    </span>
                  </div>
                  {o.urgentNeeds && (
                    <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Besoin urgent : {o.urgentNeeds}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
