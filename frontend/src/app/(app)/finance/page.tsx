'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PlayCircle, RefreshCw, Wallet } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/child/Tabs';
import { SkeletonList } from '@/components/ui/Loading';
import { date, money, num } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { ManualTransferForm } from '@/components/finance/ManualTransferForm';
import { DonationActions } from '@/components/finance/DonationActions';

export default function FinancePage() {
  const { user } = useAuth();
  // Le remboursement, le virement manuel et les prélèvements sont réservés à
  // l’Admin Finance et au Super Admin : l’Auditeur Éthique reste en lecture.
  const canOperate = ['SUPER_ADMIN', 'ADMIN_FINANCE'].includes(user?.role ?? '');
  const [tab, setTab] = useState('comptes');
  const { data: summary } = useSWR<any>('/ledger/summary', fetcher);
  const { data: accounts } = useSWR<any[]>('/ledger/accounts', fetcher);
  const { data: donations } = useSWR<any>('/payments/donations?take=50', fetcher);
  const { data: reconcile, mutate: recheck } = useSWR<any>('/ledger/reconcile', fetcher);
  const { mutate: refreshDonations } = useSWR<any>('/payments/donations?take=50', fetcher);
  const [entries, setEntries] = useState<any[]>([]);
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [charging, setCharging] = useState(false);
  const [chargeNotice, setChargeNotice] = useState<{ ok: boolean; text: string } | null>(null);

  /** Prélèvement des parrainages mensuels échus (POST /payments/sponsorships/run-charges). */
  async function runCharges() {
    if (!window.confirm('Lancer les prélèvements des parrainages échus ?')) return;
    setCharging(true);
    setChargeNotice(null);
    try {
      const r = await api.post<any>('/payments/sponsorships/run-charges', {});
      const done = r?.charged ?? r?.count ?? 0;
      setChargeNotice({
        ok: true,
        text: done ? `${done} parrainage(s) prélevé(s).` : 'Aucun parrainage n’était échu.',
      });
      refreshDonations();
      recheck();
    } catch (e: any) {
      setChargeNotice({ ok: false, text: e?.message ?? 'Le prélèvement a échoué.' });
    }
    setCharging(false);
  }

  async function showEntries(accountId: string) {
    if (openAccount === accountId) {
      setOpenAccount(null);
      return;
    }
    const r = await api.get<any>(`/ledger/accounts/${accountId}/entries?take=30`);
    setEntries(r.items);
    setOpenAccount(accountId);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Flux financiers</h1>
        {canOperate && (
          <button type="button" onClick={runCharges} disabled={charging} aria-busy={charging} className="btn-outline">
            <PlayCircle className="h-4 w-4" />
            {charging ? 'Prélèvement…' : 'Lancer les prélèvements'}
          </button>
        )}
      </div>

      {chargeNotice && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${
            chargeNotice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {chargeNotice.text}
        </p>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Compte central" value={money(summary.centralBalance)} tone="primary" icon={<Wallet className="h-5 w-5" />} />
          <Stat label="Fonds général" value={money(summary.generalFundBalance)} tone="mint" icon={<Wallet className="h-5 w-5" />} />
          <Stat label="Frais prélevés" value={money(summary.feesCollected)} tone="amber" icon={<Wallet className="h-5 w-5" />} />
          <Stat
            label="Total décaissé"
            value={money(summary.totalDisbursed)}
            hint={`${num(summary.disbursementCount)} décaissements`}
            icon={<Wallet className="h-5 w-5" />}
          />
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'comptes', label: 'Comptes', count: accounts?.length },
          { key: 'dons', label: 'Dons', count: donations?.total },
          { key: 'rapprochement', label: 'Rapprochement' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'comptes' && (
        <div className="card divide-y divide-ink-100 overflow-hidden">
          {!accounts ? (
            <div className="p-5">
              <SkeletonList rows={4} />
            </div>
          ) : (
            accounts.map((a) => (
              <div key={a.id}>
                <button
                  onClick={() => showEntries(a.id)}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-risac-50/40"
                >
                  <span className="chip bg-ink-100 text-ink-600">{a.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                    {a.label}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">{a._count.entries} ecritures</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                    {money(a.balance, a.currency)}
                  </span>
                </button>
                {openAccount === a.id && <EntryTable entries={entries} />}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'dons' && (
        <div className="space-y-4">
          {canOperate && <ManualTransferForm onRecorded={() => refreshDonations()} />}

          <div className="card divide-y divide-ink-100 overflow-hidden">
            {donations?.items?.map((d: any) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                <Badge status={d.status} />
                <div className="min-w-0 flex-1 basis-[calc(100%-6rem)] sm:basis-0">
                  <p className="truncate text-sm font-medium text-ink-800">
                    {d.child?.firstName ?? d.project?.title ?? 'Fonds général'}
                  </p>
                  <p className="break-words text-xs text-ink-400 sm:truncate">
                    {d.reference} &middot; {d.provider} &middot; {date(d.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-ink-900">
                    {money(d.amount, d.currency)}
                  </p>
                  <p className="text-xs text-ink-400">net {money(d.netAmount)}</p>
                </div>
                {canOperate && <DonationActions donation={d} onDone={() => refreshDonations()} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'rapprochement' && reconcile && (
        <div className="card card-pad space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div
              className={`flex-1 rounded-xl px-4 py-3 text-sm ${
                reconcile.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {reconcile.balanced
                ? `Comptes equilibres : ${reconcile.accountsChecked} comptes verifies`
                : `${reconcile.discrepancies.length} ecart(s) detecte(s)`}
            </div>
            <button onClick={() => recheck()} className="btn-outline">
              <RefreshCw className="h-4 w-4" />
              Relancer
            </button>
          </div>
          {reconcile.discrepancies.map((d: any) => (
            <div key={d.accountId} className="rounded-xl bg-rose-50/60 px-4 py-3 text-sm">
              <p className="font-medium text-ink-800">{d.label}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                solde stocke {money(d.stored)} / somme des ecritures {money(d.computed)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryTable({ entries }: { entries: any[] }) {
  if (!entries.length) {
    return <p className="bg-ink-50 px-5 py-3 text-xs text-ink-400">Aucune ecriture.</p>;
  }
  return (
    <div className="overflow-x-auto bg-ink-50 px-5 py-3" role="region" aria-label="Détail des comptes, tableau défilant" tabIndex={0}>
      <table className="w-full min-w-[520px] text-xs">
        <thead>
          <tr className="text-left text-ink-400">
            <th className="pb-2 font-medium">Date</th>
            <th className="pb-2 font-medium">Type</th>
            <th className="pb-2 font-medium">Libelle</th>
            <th className="pb-2 text-right font-medium">Montant</th>
            <th className="pb-2 text-right font-medium">Solde</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200/60">
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="py-1.5 text-ink-500">{date(e.createdAt)}</td>
              <td className="py-1.5 text-ink-600">{e.kind}</td>
              <td className="py-1.5 text-ink-600">{e.description}</td>
              <td
                className={`py-1.5 text-right tabular-nums ${
                  e.amount < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {money(e.amount, e.currency)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-ink-800">
                {money(e.balanceAfter, e.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
