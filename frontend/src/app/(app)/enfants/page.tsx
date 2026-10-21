'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Plus, Search, Users } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { date } from '@/lib/format';
import { FollowUpAlerts } from '@/components/child/FollowUpAlerts';

const STATUSES = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'IN_VALIDATION', label: 'En validation' },
  { value: 'NEEDS_CORRECTION', label: 'À corriger' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'TRANSFERRED', label: 'Transféré' },
  { value: 'AFTERCARE', label: 'Suivi après la sortie' },
];

export default function ChildrenPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);

  const { data, isLoading } = useSWR<any>(`/children?${params.toString()}`, fetcher);
  const canCreate = ['ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'FIELD_AGENT', 'SUPER_ADMIN'].includes(
    user?.role ?? '',
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Enfants</h1>
          <p className="mt-1 text-sm text-ink-500">
            {data ? `${data.total} dossier(s) dans votre périmètre` : 'Chargement...'}
          </p>
        </div>
        {canCreate && (
          <Link href="/enfants/nouveau" className="btn-primary">
            <Plus className="h-4 w-4" />
            Nouvel enfant
          </Link>
        )}
      </div>

      <FollowUpAlerts />

      <div className="card card-pad flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un prénom ou un identifiant"
            className="input pl-10"
            aria-label="Rechercher"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input sm:w-56"
          aria-label="Filtrer par statut"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : !data?.items?.length ? (
        <Empty
          icon={<Users className="h-6 w-6" />}
          title="Aucun dossier"
          description="Aucun enfant ne correspond a ces criteres dans votre périmètre."
        />
      ) : (
        <div className="card divide-y divide-ink-100 overflow-hidden">
          {data.items.map((c: any) => (
            <Link
              key={c.id}
              href={`/enfants/${c.id}`}
              className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-risac-50/50 sm:px-5"
            >
              <Avatar src={c.publicPhotoUrl} firstName={c.firstName} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-ink-900">{c.firstName}</p>
                  <span className="text-xs text-ink-400">{c.publicId}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-500">
                  {c.orphanage.name}
                  {c.orphanage.province ? ` - ${c.orphanage.province.nameFr}` : ''}
                  {c.assignments?.[0]
                    ? ` - ${c.assignments[0].ambassador.firstName} ${c.assignments[0].ambassador.lastName}`
                    : ' - aucun ambassadeur'}
                </p>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-xs text-ink-400">{c._count.timeline} evenements</p>
                <p className="text-xs text-ink-400">{date(c.createdAt)}</p>
              </div>

              <Badge status={c.status} className="shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
