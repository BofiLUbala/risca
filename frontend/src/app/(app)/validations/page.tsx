'use client';

import useSWR from 'swr';
import { CheckCircle2 } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { QueueItem } from '@/components/dashboard/widgets';

const KIND_LABEL: Record<string, string> = {
  CHILD_DOSSIER: 'Nouveau dossier enfant',
  CHILD_UPDATE: 'Mise à jour de dossier',
  PROJECT: 'Projet',
  ORPHANAGE_CREATION: 'Nouvel orphelinat',
  ORPHANAGE_UPDATE: 'Fiche orphelinat',
  DISBURSEMENT: 'Décaissement',
  LABEL_APPLICATION: 'Labellisation',
};

export default function ValidationsPage() {
  const { data, isLoading } = useSWR<any[]>('/approvals/queue', fetcher, { refreshInterval: 30000 });

  const groups = (data ?? []).reduce<Record<string, any[]>>((acc, r) => {
    (acc[r.kind] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Ma file de validation</h1>
        <p className="mt-1 text-sm text-ink-500">
          {data ? `${data.length} element(s) attendent votre decision` : 'Chargement...'}
        </p>
      </div>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : !data?.length ? (
        <Empty
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="Rien à valider"
          description="Votre file est vide. Les nouvelles demandes apparaîtront ici."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([kind, items]) => (
            <section key={kind}>
              <h2 className="mb-3 text-sm font-semibold text-ink-700">
                {KIND_LABEL[kind] ?? kind}
                <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                  {items.length}
                </span>
              </h2>
              <div className="space-y-2">
                {items.map((r) => (
                  <QueueItem key={r.id} request={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
