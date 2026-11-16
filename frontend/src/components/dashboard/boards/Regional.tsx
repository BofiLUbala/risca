'use client';

import Link from 'next/link';
import { AlertTriangle, Building2, CheckCircle2, GraduationCap, Users } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { AlertRow, CountRow, Progress, SectionTitle } from '../widgets';
import { date, num } from '@/lib/format';
import { t as tx } from '@/lib/i18n';


export function RegionalBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={tx("Orphelinats")} value={num(data.region.orphanages)} tone="primary" icon={<Building2 className="h-5 w-5" />} />
        <Stat
          label={tx("Enfants")}
          value={num(data.region.children)}
          hint={tx("{completionRate} % de dossiers complets", { completionRate: data.dossiers.completionRate })}
          tone="primary"
          icon={<Users className="h-5 w-5" />}
        />
        <Stat label={tx("À valider")} value={num(data.validationQueue)} tone="amber" icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat
          label={tx("Alertes")}
          value={num(data.alerts.overdue)}
          hint={tx("{v0} proches de 18 ans", { v0: num(data.alerts.nearingAdulthood) })}
          tone="coral"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle>{tx("Taux de dossiers complets")}</SectionTitle>
          <Progress
            value={data.dossiers.active}
            total={data.region.children || 1}
            label={tx("{v0} dossiers actifs", { v0: num(data.dossiers.active) })}
          />
          <div className="mt-4">
            <CountRow label={tx("Brouillons")} value={data.dossiers.draft} />
            <CountRow label={tx("En validation")} value={data.dossiers.inValidation} />
            <CountRow label={tx("Actifs")} value={data.dossiers.active} />
          </div>
        </section>

        <section className="card card-pad lg:col-span-2">
          <SectionTitle
            action={
              <Link href="/enfants" className="link-action">
                {tx("Tout voir")}
              </Link>
            }
          >
            {tx("Mises à jour en retard")}
          </SectionTitle>
          <div className="space-y-2">
            {data.overdueDetails.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">{tx("Aucun retard signale.")}</p>
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
          <SectionTitle>{tx("Performance des ambassadeurs")}</SectionTitle>
          <div className="space-y-2">
            {data.ambassadorPerformance.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3">
                <span className="min-w-0 truncate text-sm font-medium text-ink-800">
                  {a.firstName} {a.lastName}
                </span>
                <span className="shrink-0 text-xs text-ink-500">
                  {num(a._count.assignments)}{' '}{tx("enfants,")}{' '}{num(a._count.visitReports)}{' '}{tx("visites,")}{' '}
                  {num(a._count.posts)}{' '}{tx("publications")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <SectionTitle>{tx("Post-majorite a preparer")}</SectionTitle>
          <div className="space-y-2">
            {data.nearingAdulthood.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">{tx("Aucun enfant proche de la majorite.")}</p>
            )}
            {data.nearingAdulthood.map((c: any) => (
              <Link
                key={c.id}
                href={`/enfants/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 hover:bg-sun-50"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink-800">
                  <GraduationCap className="h-4 w-4 text-ink-400" />
                  {c.firstName} ({c.publicId})
                </span>
                <span className="text-xs text-ink-500">
                  {c.postMajorityPrepared ? tx("Preparation engagee") : tx("A preparer")}{tx(", ne le")}{' '}
                  {date(c.birthDate)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {data.pendingTransfers.length > 0 && (
        <section className="card card-pad">
          <SectionTitle>{tx("Transferts à valider")}</SectionTitle>
          <div className="space-y-2">
            {data.pendingTransfers.map((t: any) => (
              <AlertRow
                key={t.id}
                title={tx("Transfert de {firstName} ({publicId})", { firstName: t.child.firstName, publicId: t.child.publicId })}
                detail={t.reason ?? tx("Aucun motif precise")}
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
