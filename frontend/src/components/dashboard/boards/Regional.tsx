'use client';

import Link from 'next/link';
import { AlertTriangle, Building2, CheckCircle2, GraduationCap, Users } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { AlertRow, CountRow, Progress, SectionTitle } from '../widgets';
import { date, num } from '@/lib/format';

export function RegionalBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orphelinats" value={num(data.region.orphanages)} tone="primary" icon={<Building2 className="h-5 w-5" />} />
        <Stat
          label="Enfants"
          value={num(data.region.children)}
          hint={`${data.dossiers.completionRate} % de dossiers complets`}
          tone="primary"
          icon={<Users className="h-5 w-5" />}
        />
        <Stat label="À valider" value={num(data.validationQueue)} tone="amber" icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat
          label="Alertes"
          value={num(data.alerts.overdue)}
          hint={`${num(data.alerts.nearingAdulthood)} proches de 18 ans`}
          tone="coral"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle>Taux de dossiers complets</SectionTitle>
          <Progress
            value={data.dossiers.active}
            total={data.region.children || 1}
            label={`${num(data.dossiers.active)} dossiers actifs`}
          />
          <div className="mt-4">
            <CountRow label="Brouillons" value={data.dossiers.draft} />
            <CountRow label="En validation" value={data.dossiers.inValidation} />
            <CountRow label="Actifs" value={data.dossiers.active} />
          </div>
        </section>

        <section className="card card-pad lg:col-span-2">
          <SectionTitle
            action={
              <Link href="/enfants" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                Tout voir
              </Link>
            }
          >
            Mises à jour en retard
          </SectionTitle>
          <div className="space-y-2">
            {data.overdueDetails.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">Aucun retard signale.</p>
            )}
            {data.overdueDetails.map((a: any, i: number) => (
              <AlertRow
                key={`${a.childId}-${a.kind}-${i}`}
                title={`${a.firstName} (${a.publicId}) - ${a.orphanage}`}
                detail={a.message}
                href={`/enfants/${a.childId}`}
                tone={a.kind === 'VISIT_OVERDUE' ? 'coral' : 'amber'}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <SectionTitle>Performance des ambassadeurs</SectionTitle>
          <div className="space-y-2">
            {data.ambassadorPerformance.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3">
                <span className="min-w-0 truncate text-sm font-medium text-ink-800">
                  {a.firstName} {a.lastName}
                </span>
                <span className="shrink-0 text-xs text-ink-500">
                  {num(a._count.assignments)} enfants, {num(a._count.visitReports)} visites,{' '}
                  {num(a._count.posts)} publications
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <SectionTitle>Post-majorite a preparer</SectionTitle>
          <div className="space-y-2">
            {data.nearingAdulthood.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">Aucun enfant proche de la majorite.</p>
            )}
            {data.nearingAdulthood.map((c: any) => (
              <Link
                key={c.id}
                href={`/enfants/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 hover:bg-risac-50"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink-800">
                  <GraduationCap className="h-4 w-4 text-ink-400" />
                  {c.firstName} ({c.publicId})
                </span>
                <span className="text-xs text-ink-500">
                  {c.postMajorityPrepared ? 'Preparation engagee' : 'A preparer'}, ne le{' '}
                  {date(c.birthDate)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {data.pendingTransfers.length > 0 && (
        <section className="card card-pad">
          <SectionTitle>Transferts à valider</SectionTitle>
          <div className="space-y-2">
            {data.pendingTransfers.map((t: any) => (
              <AlertRow
                key={t.id}
                title={`Transfert de ${t.child.firstName} (${t.child.publicId})`}
                detail={t.reason ?? 'Aucun motif precise'}
                href={`/enfants/${t.childId}`}
                tone="primary"
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
