'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Building2, MapPin, Plus, Users } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/roles';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { dateTime, num } from '@/lib/format';
import { t, geoName } from '@/lib/i18n';

/** Mêmes rôles que `POST /orphanages` côté API (orphanages.controller.ts). */
const CAN_CREATE: Role[] = ['SUPER_ADMIN', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'FIELD_AGENT'];

export default function OrphanagesPage() {
  const { user } = useAuth();
  const { data, isLoading } = useSWR<any[]>('/orphanages', fetcher);
  const canCreate = !!user && CAN_CREATE.includes(user.role);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{t("Orphelinats")}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {data ? t("{length} structure(s) dans votre périmètre", { length: data.length }) : t("Chargement…")}
          </p>
        </div>
        {canCreate && (
          <Link href="/orphelinats/nouveau" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {user?.role === 'FIELD_AGENT' ? t("Proposer un orphelinat") : t("Ajouter un orphelinat")}
          </Link>
        )}
      </div>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : !data?.length ? (
        <Empty icon={<Building2 className="h-6 w-6" />} title={t("Aucune structure")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((o) => (
            <Link
              key={o.id}
              href={`/orphelinats/${o.id}`}
              className="card card-pad transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="section-title">{o.name}</h2>
                <Badge status={o.labelStatus} />
              </div>

              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                <MapPin className="h-3.5 w-3.5" />
                {o.city ? `${o.city}, ` : ''}
                {geoName(o.province)}
                {o.province.riskZone && (
                  <span className="chip bg-amber-50 text-amber-700">{t("zone a risque")}</span>
                )}
              </p>

              {o.description && (
                <p className="mt-3 line-clamp-2 text-sm text-ink-600">{o.description}</p>
              )}

              {o.proposedBy && (
                <p className="mt-2 text-xs text-ink-400">
                  {t("Enregistré par")}{' '}{o.proposedBy.firstName} {o.proposedBy.lastName}
                  {o.createdAt ? t(" le {date}", { date: dateTime(o.createdAt) }) : ''}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {num(o._count.children)}{' '}{t("enfants")}
                </span>
                <span>
                  {num(o.occupiedPlaces)} / {num(o.totalPlaces)}{' '}{t("places")}
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
