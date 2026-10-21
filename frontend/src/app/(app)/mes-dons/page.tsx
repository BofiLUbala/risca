'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Download, FileCheck, HeartHandshake, Undo2 } from 'lucide-react';
import { api, API_URL, fetcher, getToken } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Stat } from '@/components/ui/Stat';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { date, money, num } from '@/lib/format';

export default function MyDonationsPage() {
  const { data: donations, isLoading, mutate } = useSWR<any[]>('/payments/donations/mine', fetcher);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const { data: impact } = useSWR<any>('/payments/impact', fetcher);
  const { data: proofs } = useSWR<any[]>('/disbursements/proofs', fetcher);

  async function downloadReceipt(id: string) {
    const res = await fetch(`${API_URL}/payments/donations/${id}/receipt`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu-risac-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Retrait d’un don affecté à un projet dont la collecte n’a pas encore démarré
   * (POST /payments/donations/:id/withdraw). Refuse par l API des que le projet
   * est en exécution ou que les fonds ont été décaissés.
   */
  async function withdraw(d: any) {
    const label = d.project?.title ?? 'ce projet';
    if (!window.confirm(`Retirer votre don de ${label} ?`)) return;
    setWithdrawing(d.id);
    setNotice(null);
    try {
      await api.post(`/payments/donations/${d.id}/withdraw`, {});
      setNotice({ ok: true, text: 'Votre don a été retiré. Le remboursement suit le circuit habituel.' });
      mutate();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'Le retrait a échoué.' });
    }
    setWithdrawing(null);
  }

  return (
    <div className="space-y-5">
      <h1 className="page-title">Mes dons</h1>

      {notice && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${
            notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      {impact && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total donné" value={money(impact.totalDonatedUsd)} tone="mint" icon={<HeartHandshake className="h-5 w-5" />} />
          <Stat label="Dons effectués" value={num(impact.donationCount)} tone="primary" />
          <Stat label="Enfants soutenus" value={num(impact.childrenSupported)} tone="primary" />
          <Stat label="Projets soutenus" value={num(impact.projectsSupported)} tone="amber" />
        </div>
      )}

      <section>
        <h2 className="mb-3 card-title">Historique</h2>
        {isLoading ? (
          <SkeletonList rows={4} />
        ) : !donations?.length ? (
          <Empty
            icon={<HeartHandshake className="h-6 w-6" />}
            title="Aucun don pour le moment"
            description="Vos dons et leurs reçus apparaîtront ici."
            action={
              <Link href="/enfants-a-soutenir" className="btn-primary">
                Soutenir un enfant
              </Link>
            }
          />
        ) : (
          <div className="card divide-y divide-ink-100 overflow-hidden">
            {donations.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Badge status={d.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">
                    {d.child?.firstName ?? d.project?.title ?? 'Fonds général'}
                  </p>
                  <p className="text-xs text-ink-400">
                    {d.reference} &middot; {date(d.createdAt)} &middot; {d.provider}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                  {money(d.amount, d.currency)}
                </p>
                {d.status === 'SUCCEEDED' && (
                  <button onClick={() => downloadReceipt(d.id)} className="btn-ghost h-9 px-2.5" aria-label="Télécharger le reçu">
                    <Download className="h-4 w-4" />
                  </button>
                )}
                {d.status === 'PENDING' && d.checkoutUrl && (
                  <a href={d.checkoutUrl} className="btn-soft h-9">
                    Finaliser
                  </a>
                )}
                {d.status === 'SUCCEEDED' && d.projectId && (
                  <button
                    onClick={() => withdraw(d)}
                    disabled={withdrawing === d.id}
                    aria-busy={withdrawing === d.id}
                    className="btn-outline h-9 px-3 text-xs"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    {withdrawing === d.id ? 'Retrait…' : 'Retirer'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 card-title">Preuves de dépense</h2>
        {!proofs?.length ? (
          <div className="card card-pad text-sm text-ink-400">
            Les justificatifs apparaîtront ici une fois les fonds depenses par la structure.
          </div>
        ) : (
          <div className="space-y-3">
            {proofs.map((p) => (
              <article key={p.id} className="card card-pad">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{p.summary}</p>
                    <p className="mt-1 text-xs text-ink-400">
                      {p.orphanage} &middot; {date(p.paidAt)} &middot; {money(p.amount, p.currency)}
                    </p>
                  </div>
                  <Badge status={p.status} />
                </div>
                {p.receipts.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                    {p.receipts.map((r: any) => (
                      <li key={r.id} className="chip bg-ink-100 text-ink-600">
                        <FileCheck className="h-3 w-3" />
                        {r.name}
                        {r.amount ? ` - ${money(r.amount)}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
