'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Building2, MapPin, Users } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { num } from '@/lib/format';

export default function OrphanagesPage() {
  const { data, isLoading } = useSWR<any[]>('/orphanages', fetcher);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Orphelinats</h1>
        <p className="mt-1 text-sm text-ink-500">
          {data ? `${data.length} structure(s) dans votre périmètre` : 'Chargement...'}
        </p>
      </div>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : !data?.length ? (
        <Empty icon={<Building2 className="h-6 w-6" />} title="Aucune structure" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((o) => (
            <Link
              key={o.id}
              href={`/orphelinats/${o.id}`}
              className="card card-pad transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="section-title">{o.name}</h2>
                <Badge status={o.labelStatus} />
              </div>

              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                <MapPin className="h-3.5 w-3.5" />
                {o.city ? `${o.city}, ` : ''}
                {o.province.nameFr}
                {o.province.riskZone && (
                  <span className="chip bg-amber-50 text-amber-700">zone a risque</span>
                )}
              </p>

              {o.description && (
                <p className="mt-3 line-clamp-2 text-sm text-ink-600">{o.description}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {num(o._count.children)} enfants
                </span>
                <span>
                  {num(o.occupiedPlaces)} / {num(o.totalPlaces)} places
                </span>
                <Badge status={o.status} className="ml-auto" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
