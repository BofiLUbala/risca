'use client';

import Link from 'next/link';
import { Eye, FileWarning, Lock, ScrollText } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { CountRow, MoneyRow, SectionTitle } from '../widgets';
import { dateTime, money, num } from '@/lib/format';

export function AuditorBoard({ data }: { data: any }) {
  return (
    <>
      <div className="rounded-2xl border border-risac-200 bg-risac-50/70 px-5 py-4 text-sm text-risac-800">
        Acces en lecture seule sur l’ensemble du réseau. Vous pouvez geler un projet ou un compte en
        attendant la décision du Super Admin.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Signalements graves" value={num(data.governance.seriousReports)} tone="coral" icon={<FileWarning className="h-5 w-5" />} />
        <Stat label="Projets geles" value={num(data.governance.frozenProjects)} tone="amber" icon={<Lock className="h-5 w-5" />} />
        <Stat label="Comptes geles" value={num(data.governance.frozenUsers)} tone="amber" icon={<Lock className="h-5 w-5" />} />
        <Stat label="Entrées d’audit" value={num(data.auditTrail.total)} tone="primary" icon={<ScrollText className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle>Conformité</SectionTitle>
          <CountRow label="Enfants sans consentement photo" value={data.compliance.childrenWithoutConsent} />
          <CountRow label="Acces psychotrauma (30 j)" value={data.compliance.psychoAccessLast30Days} />
        </section>

        <section className="card card-pad">
          <SectionTitle>Flux financiers</SectionTitle>
          <MoneyRow label="Compte central" value={data.money.centralBalance} />
          <MoneyRow label="Fonds général" value={data.money.generalFundBalance} />
          <MoneyRow label="Total collecté" value={data.money.totalDonated} />
          <MoneyRow label="Total décaissé" value={data.money.totalDisbursed} strong />
        </section>

        <section className="card card-pad">
          <SectionTitle>Rapprochement</SectionTitle>
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              data.reconciliation.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {data.reconciliation.balanced
              ? `Comptes equilibres (${data.reconciliation.accountsChecked} verifies)`
              : `${data.reconciliation.discrepancies.length} ecart(s)`}
          </div>
        </section>
      </div>

      <section className="card card-pad">
        <SectionTitle
          action={
            <Link href="/journal-audit" className="text-sm font-medium text-risac-600 hover:text-risac-700">
              Journal complet
            </Link>
          }
        >
          Activite recente
        </SectionTitle>
        <div className="divide-y divide-ink-100">
          {data.auditTrail.recent.map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">{a.action}</p>
                <p className="text-xs text-ink-400">
                  {a.actor ? `${a.actor.firstName} ${a.actor.lastName} (${a.actor.role})` : 'systeme'}
                  {' · '}
                  {a.entityType}
                </p>
              </div>
              <span className="shrink-0 text-xs text-ink-400">{dateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
