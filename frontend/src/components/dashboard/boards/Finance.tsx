'use client';

import Link from 'next/link';
import { Banknote, CheckCircle2, FileCheck, Wallet } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { CountRow, MoneyRow, SectionTitle } from '../widgets';
import { date, money, num } from '@/lib/format';
import { t } from '@/lib/i18n';


export function FinanceBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t("Compte central")}
          value={money(data.money.centralBalance)}
          tone="primary"
          icon={<Wallet className="h-5 w-5" />}
        />
        <Stat
          label={t("À approuver")}
          value={num(data.disbursements.toApprove)}
          hint={t("demandes confirmees par l’ambassadeur")}
          tone="amber"
          icon={<Banknote className="h-5 w-5" />}
        />
        <Stat
          label={t("Justificatifs attendus")}
          value={num(data.disbursements.awaitingReceipts)}
          tone="coral"
          icon={<FileCheck className="h-5 w-5" />}
        />
        <Stat
          label={t("Dépenses soldées")}
          value={num(data.disbursements.settled)}
          tone="mint"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle>{t("Soldes")}</SectionTitle>
          <MoneyRow label={t("Compte central")} value={data.money.centralBalance} />
          <MoneyRow label={t("Fonds général")} value={data.money.generalFundBalance} />
          <MoneyRow label={t("Frais de fonctionnement")} value={data.money.feesCollected} />
          {data.money.byAccountKind.map((k: any) => (
            <MoneyRow key={k.kind} label={`${k.kind} (${k.accounts})`} value={k.total} />
          ))}
        </section>

        <section className="card card-pad">
          <SectionTitle>{t("Totaux")}</SectionTitle>
          <MoneyRow label={t("Total collecté")} value={data.money.totalDonated} />
          <MoneyRow label={t("Frais prélevés")} value={data.money.totalFees} />
          <MoneyRow label={t("Net affecté")} value={data.money.totalNet} />
          <MoneyRow label={t("Total décaissé")} value={data.money.totalDisbursed} strong />
          <CountRow label={t("Nombre de dons")} value={data.money.donationCount} />
        </section>

        <section className="card card-pad">
          <SectionTitle>{t("Rapprochement quotidien")}</SectionTitle>
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              data.reconciliation.balanced
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {data.reconciliation.balanced
              ? t("Comptes equilibres ({accountsChecked} comptes verifies)", { accountsChecked: data.reconciliation.accountsChecked })
              : t("{length} ecart(s) detecte(s)", { length: data.reconciliation.discrepancies.length })}
          </div>
          {data.reconciliation.discrepancies.map((d: any) => (
            <div key={d.accountId} className="mt-3 rounded-xl bg-rose-50/60 px-4 py-3 text-xs">
              <p className="font-medium text-ink-800">{d.label}</p>
              <p className="mt-0.5 text-ink-500">
                {t("stocke")}{' '}{money(d.stored)}{' '}{t("/ calcule")}{' '}{money(d.computed)}
              </p>
            </div>
          ))}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <SectionTitle
            action={
              <Link href="/finance" className="link-action">
                {t("Tout voir")}
              </Link>
            }
          >
            {t("Derniers dons réglés")}
          </SectionTitle>
          <div className="space-y-2">
            {data.recentDonations.map((d: any) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">
                    {d.child?.firstName ?? d.project?.title ?? t("Fonds général")}
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
          <SectionTitle>{t("Par fournisseur de paiement")}</SectionTitle>
          <div className="space-y-2">
            {data.byProvider.map((p: any) => (
              <div
                key={p.provider}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink-800">{p.provider}</p>
                  <p className="text-xs text-ink-400">{num(p.count)}{' '}{t("transactions")}</p>
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
