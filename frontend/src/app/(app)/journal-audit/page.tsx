'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ScrollText } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { dateTime } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 50;

  const params = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (entityType) params.set('entityType', entityType);

  const { data, isLoading } = useSWR<any>(`/dashboard/audit-log?${params.toString()}`, fetcher);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Journal d’audit</h1>
          <p className="mt-1 text-sm text-ink-500">
            Non modifiable : qui a consulte ou modifie quoi, et quand.
            {data ? ` ${data.total} entrees.` : ''}
          </p>
        </div>
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setSkip(0);
          }}
          className="input w-56"
          aria-label="Filtrer par entite"
        >
          <option value="">Toutes les entites</option>
          <option value="User">Utilisateurs</option>
          <option value="Child">Enfants</option>
          <option value="Orphanage">Orphelinats</option>
          <option value="Project">Projets</option>
          <option value="Donation">Dons</option>
          <option value="DisbursementRequest">Décaissements</option>
          <option value="Post">Publications</option>
        </select>
      </div>

      {isLoading ? (
        <SkeletonList rows={6} />
      ) : !data?.items?.length ? (
        <Empty icon={<ScrollText className="h-6 w-6" />} title="Aucune entree" />
      ) : (
        <>
          <div className="card overflow-x-auto" role="region" aria-label="Journal d’audit, tableau défilant" tabIndex={0}>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 text-left text-table-head text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Acteur</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Entite</th>
                  <th className="px-5 py-3 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {data.items.map((a: any) => (
                  <tr key={a.id} className="hover:bg-ink-50/50">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-500">
                      {dateTime(a.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      {a.actor ? (
                        <span>
                          <span className="block text-ink-800">
                            {a.actor.firstName} {a.actor.lastName}
                          </span>
                          <span className="block text-xs text-ink-400">
                            {ROLE_LABEL[a.actor.role as keyof typeof ROLE_LABEL] ?? a.actor.role}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-400">systeme</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="chip bg-ink-100 text-ink-700">{a.action}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-500">{a.entityType}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-xs text-ink-400">
                      {a.metadata && Object.keys(a.metadata).length > 0
                        ? JSON.stringify(a.metadata)
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setSkip(Math.max(0, skip - take))}
              disabled={skip === 0}
              className="btn-outline"
            >
              Precedent
            </button>
            <span className="text-sm text-ink-500">
              {skip + 1} - {Math.min(skip + take, data.total)} sur {data.total}
            </span>
            <button
              onClick={() => setSkip(skip + take)}
              disabled={skip + take >= data.total}
              className="btn-outline"
            >
              Suivant
            </button>
          </div>
        </>
      )}
    </div>
  );
}
