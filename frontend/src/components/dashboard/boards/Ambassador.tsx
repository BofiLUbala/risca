'use client';

import Link from 'next/link';
import { AlertTriangle, Banknote, CheckCircle2, Eye, Heart, Users } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { AlertRow, QueueItem, SectionTitle } from '../widgets';
import { money, num } from '@/lib/format';

const FONAREV_LABEL: Record<string, string> = {
  IDENTIFIED: 'Identifie',
  ORIENTED: 'Oriente',
  FILED: 'Dossier depose',
  REPARATION_OBTAINED: 'Reparation obtenue',
};

export function AmbassadorBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Mes enfants" value={num(data.myChildren)} tone="primary" icon={<Users className="h-5 w-5" />} />
        <Stat label="À valider" value={num(data.validationQueue)} tone="amber" icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat
          label="Décaissements à confirmer"
          value={num(data.disbursementsToConfirm)}
          tone="coral"
          icon={<Banknote className="h-5 w-5" />}
        />
        <Stat
          label="Fonds levés"
          value={money(data.fundsRaised)}
          hint={`${num(data.sponsoredChildren)} enfants parraines`}
          tone="mint"
          icon={<Heart className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <SectionTitle
            action={
              <Link href="/validations" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                File complete
              </Link>
            }
          >
            Ma file de validation
          </SectionTitle>
          <div className="space-y-2">
            {data.queueDetails.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">Rien à valider pour le moment.</p>
            )}
            {data.queueDetails.map((r: any) => (
              <QueueItem key={r.id} request={r} />
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <SectionTitle
            action={
              <Link href="/enfants" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                Mes enfants
              </Link>
            }
          >
            Rappels
          </SectionTitle>
          <div className="space-y-2">
            {data.alerts.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">Aucun rappel en cours.</p>
            )}
            {data.alerts.slice(0, 8).map((a: any, i: number) => (
              <AlertRow
                key={`${a.childId}-${a.kind}-${i}`}
                title={`${a.firstName} (${a.publicId})`}
                detail={a.message}
                href={`/enfants/${a.childId}`}
                tone={a.kind === 'VISIT_OVERDUE' ? 'coral' : 'amber'}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle
            action={
              <Link href="/communication" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                Publier
              </Link>
            }
          >
            Mes publications
          </SectionTitle>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-ink-50 py-3">
              <p className="text-xl font-semibold text-ink-900">{num(data.publications.count)}</p>
              <p className="text-xs text-ink-500">publications</p>
            </div>
            <div className="rounded-xl bg-ink-50 py-3">
              <p className="text-xl font-semibold text-ink-900">{num(data.publications.views)}</p>
              <p className="text-xs text-ink-500">vues</p>
            </div>
            <div className="rounded-xl bg-ink-50 py-3">
              <p className="text-xl font-semibold text-ink-900">{num(data.publications.reactions)}</p>
              <p className="text-xs text-ink-500">reactions</p>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-400">
            <Eye className="h-3.5 w-3.5" />
            {num(data.visitReports)} rapports de visite deposes
          </p>
        </section>

        <section className="card card-pad lg:col-span-2">
          <SectionTitle>Demarches FONAREV</SectionTitle>
          {data.fonarev.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">Aucune demarche en cours.</p>
          ) : (
            <div className="space-y-2">
              {data.fonarev.map((f: any) => (
                <Link
                  key={f.id}
                  href={`/enfants/${f.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 hover:bg-risac-50"
                >
                  <span className="text-sm font-medium text-ink-800">
                    {f.firstName} ({f.publicId})
                  </span>
                  <span className="text-xs text-ink-500">
                    {FONAREV_LABEL[f.fonarevStatus] ?? f.fonarevStatus}
                    {f.fonarevFileNumber ? ` - dossier ${f.fonarevFileNumber}` : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
