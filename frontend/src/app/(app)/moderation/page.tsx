'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ShieldAlert } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { dateTime } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';

export default function ModerationPage() {
  const [status, setStatus] = useState('OPEN');
  const { data, isLoading, mutate } = useSWR<any[]>(`/moderation/reports?status=${status}`, fetcher);
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string, decision: 'ACTIONED' | 'DISMISSED') {
    const resolution = window.prompt(
      decision === 'ACTIONED' ? 'Mesure prise ?' : 'Motif du classement sans suite ?',
    );
    if (!resolution) return;
    setBusy(id);
    await api.post(`/moderation/reports/${id}/resolve`, { status: decision, resolution });
    mutate();
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Modération</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-48" aria-label="Statut">
          <option value="OPEN">Ouverts</option>
          <option value="REVIEWING">En cours</option>
          <option value="ACTIONED">Traites</option>
          <option value="DISMISSED">Classes</option>
        </select>
      </div>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : !data?.length ? (
        <Empty icon={<ShieldAlert className="h-6 w-6" />} title="Aucun signalement" />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <article key={r.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink-900">{r.reason}</p>
                    {r.severity === 'SERIOUS' && (
                      <span className="chip bg-rose-100 text-rose-700">Grave</span>
                    )}
                    <Badge status={r.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {r.targetType} &middot; signale par {r.reporter.firstName} {r.reporter.lastName} (
                    {ROLE_LABEL[r.reporter.role as keyof typeof ROLE_LABEL]}) &middot;{' '}
                    {dateTime(r.createdAt)}
                  </p>
                  {r.details && <p className="mt-2 text-sm text-ink-600">{r.details}</p>}
                  {r.resolution && (
                    <p className="mt-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">
                      Resolution : {r.resolution}
                    </p>
                  )}
                </div>
              </div>

              {r.status === 'OPEN' && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                  <button onClick={() => resolve(r.id, 'ACTIONED')} disabled={busy === r.id} className="btn-primary">
                    Traiter
                  </button>
                  <button onClick={() => resolve(r.id, 'DISMISSED')} disabled={busy === r.id} className="btn-ghost">
                    Classer sans suite
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
