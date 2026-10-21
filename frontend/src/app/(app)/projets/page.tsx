'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Plus, Target } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { money, percent } from '@/lib/format';

const STATUSES = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'IN_VALIDATION', label: 'En validation' },
  { value: 'PUBLISHED', label: 'Publié' },
  { value: 'FULLY_FUNDED', label: 'Financé à 100 %' },
  { value: 'IN_EXECUTION', label: 'En exécution' },
  { value: 'COMPLETED', label: 'Terminé' },
];

export default function ProjectsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useSWR<any[]>(`/projects${status ? `?status=${status}` : ''}`, fetcher);

  const canCreate = ['ORPHANAGE_DIRECTOR', 'AMBASSADOR', 'REGIONAL_MANAGER', 'SUPER_ADMIN'].includes(
    user?.role ?? '',
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Projets</h1>
        <div className="flex gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-48" aria-label="Statut">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {canCreate && (
            <Link href="/projets/nouveau" className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouveau projet
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : !data?.length ? (
        <Empty icon={<Target className="h-6 w-6" />} title="Aucun projet" />
      ) : (
        <div className="space-y-3">
          {data.map((p) => (
            <Link key={p.id} href={`/projets/${p.id}`} className="card card-pad block hover:shadow-lift">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-ink-900">{p.title}</h2>
                    <Badge status={p.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {p.child ? `${p.child.firstName} (${p.child.publicId})` : (p.orphanage?.name ?? '')}
                    {p.category ? ` - ${p.category}` : ''}
                    {` - ${p._count.donations} bailleur(s)`}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                  {money(p.collectedAmount, p.currency)} / {money(p.targetAmount, p.currency)}
                </p>
              </div>

              <p className="mt-3 line-clamp-2 text-sm text-ink-600">{p.description}</p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-risac-400 to-risac-600"
                  style={{ width: `${percent(p.collectedAmount, p.targetAmount)}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
