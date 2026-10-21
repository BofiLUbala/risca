'use client';

import Link from 'next/link';
import { Banknote, CheckCircle2, FileCheck, Wallet } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { CountRow, MoneyRow, SectionTitle } from '../widgets';
import { date, money, num } from '@/lib/format';

export function FinanceBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Compte central"
          value={money(data.money.centralBalance)}
          tone="primary"
          icon={<Wallet className="h-5 w-5" />}
        />
        <Stat
          label="À approuver"
          value={num(data.disbursements.toApprove)}
          hint="demandes confirmees par l’ambassadeur"
          tone="amber"
          icon={<Banknote className="h-5 w-5" />}
        />
        <Stat
          label="Justificatifs attendus"
          value={num(data.disbursements.awaitingReceipts)}
          tone="coral"
          icon={<FileCheck className="h-5 w-5" />}
        />
        <Stat
          label="Dépenses soldées"
          value={num(data.disbursements.settled)}
          tone="mint"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle>Soldes</SectionTitle>
          <MoneyRow label="Compte central" value={data.money.centralBalance} />
          <MoneyRow label="Fonds général" value={data.money.generalFundBalance} />
          <MoneyRow label="Frais de fonctionnement" value={data.money.feesCollected} />
          {data.money.byAccountKind.map((k: any) => (
            <MoneyRow key={k.kind} label={`${k.kind} (${k.accounts})`} value={k.total} />
          ))}
        </section>

        <section className="card card-pad">
          <SectionTitle>Totaux</SectionTitle>
          <MoneyRow label="Total collecté" value={data.money.totalDonated} />
          <MoneyRow label="Frais prélevés" value={data.money.totalFees} />
          <MoneyRow label="Net affecté" value={data.money.totalNet} />
          <MoneyRow label="Total décaissé" value={data.money.totalDisbursed} strong />
          <CountRow label="Nombre de dons" value={data.money.donationCount} />
        </section>

        <section className="card card-pad">
          <SectionTitle>Rapprochement quotidien</SectionTitle>
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              data.reconciliation.balanced
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {data.reconciliation.balanced
              ? `Comptes equilibres (${data.reconciliation.accountsChecked} comptes verifies)`
              : `${data.reconciliation.discrepancies.length} ecart(s) detecte(s)`}
          </div>
          {data.reconciliation.discrepancies.map((d: any) => (
            <div key={d.accountId} className="mt-3 rounded-xl bg-rose-50/60 px-4 py-3 text-xs">
              <p className="font-medium text-ink-800">{d.label}</p>
              <p className="mt-0.5 text-ink-500">
                stocke {money(d.stored)} / calcule {money(d.computed)}
              </p>
            </div>
          ))}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <SectionTitle
            action={
              <Link href="/finance" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                Tout voir
              </Link>
            }
          >
            Derniers dons réglés
          </SectionTitle>
          <div className="space-y-2">
            {data.recentDonations.map((d: any) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">
                    {d.child?.firstName ?? d.project?.title ?? 'Fonds général'}
                  </p>
                  <p className="text-xs text-ink-400">{date(d.paidAt)}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                  {money(d.amount, d.currency)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <SectionTitle>Par fournisseur de paiement</SectionTitle>
          <div className="space-y-2">
            {data.byProvider.map((p: any) => (
              <div
                key={p.provider}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink-800">{p.provider}</p>
                  <p className="text-xs text-ink-400">{num(p.count)} transactions</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink-900">
                  {money(p.total)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
