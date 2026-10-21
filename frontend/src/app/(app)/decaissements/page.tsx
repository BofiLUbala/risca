'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Banknote, Check, FileUp, Plus, X } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList, Spinner } from '@/components/ui/Loading';
import { date, money } from '@/lib/format';

export default function DisbursementsPage() {
  const { user } = useAuth();
  const { data, isLoading, mutate } = useSWR<any[]>('/disbursements', fetcher);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ amount: '', reason: '' });

  const isDirector = user?.role === 'ORPHANAGE_DIRECTOR';
  const isAmbassador = user?.role === 'AMBASSADOR';
  const isFinance = user?.role === 'ADMIN_FINANCE' || user?.role === 'SUPER_ADMIN';

  async function act(id: string, path: string, body?: any) {
    setBusy(id + path);
    setError(null);
    try {
      await api.post(`/disbursements/${id}/${path}`, body ?? {});
      mutate();
    } catch (e: any) {
      setError(e?.message ?? 'Action impossible');
    }
    setBusy(null);
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy('new');
    setError(null);
    try {
      await api.post('/disbursements', { amount: Number(form.amount), reason: form.reason });
      setForm({ amount: '', reason: '' });
      setShowNew(false);
      mutate();
    } catch (err: any) {
      setError(err?.message ?? 'Demande impossible');
    }
    setBusy(null);
  }

  async function addReceipt(id: string) {
    const name = window.prompt('Nom du justificatif ?');
    if (!name) return;
    const amount = window.prompt('Montant justifie ?');
    await act(id, 'receipts', {
      name,
      url: `/uploads/${name.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      amount: amount ? Number(amount) : undefined,
      kind: 'INVOICE',
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Décaissements</h1>
          <p className="mt-1 text-sm text-ink-500">
            Le chef d’orphelinat demande, l’ambassadeur confirme, l’Admin Finance paie.
          </p>
        </div>
        {isDirector && (
          <button onClick={() => setShowNew((s) => !s)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nouvelle demande
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {showNew && (
        <form onSubmit={createRequest} className="card card-pad space-y-4">
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div>
              <label htmlFor="amount" className="label">
                Montant (USD)
              </label>
              <input
                id="amount"
                type="number"
                min={1}
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="reason" className="label">
                Motif
              </label>
              <input
                id="reason"
                required
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="input"
                placeholder="Frais scolaires du trimestre"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy === 'new'} className="btn-primary">
              {busy === 'new' ? <Spinner className="h-4 w-4" /> : null}
              Envoyer la demande
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="btn-ghost">
              Annuler
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : !data?.length ? (
        <Empty
          icon={<Banknote className="h-6 w-6" />}
          title="Aucun décaissement"
          description="Les demandes de décaissement apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {data.map((d) => (
            <article key={d.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink-900">{d.reason}</p>
                    <Badge status={d.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {d.reference} &middot; {d.orphanage.name} &middot; demande le {date(d.createdAt)}
                    {d.requestedBy ? ` par ${d.requestedBy.firstName} ${d.requestedBy.lastName}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-semibold tabular-nums text-ink-900">
                  {money(d.amount, d.currency)}
                </p>
              </div>

              {d.receipts?.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-xs text-ink-500">
                  {d.receipts.map((r: any) => (
                    <li key={r.id}>
                      {r.name} {r.amount ? `- ${money(r.amount)}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {isAmbassador && d.status === 'REQUESTED' && (
                  <>
                    <button onClick={() => act(d.id, 'confirm')} disabled={!!busy} className="btn-primary">
                      <Check className="h-4 w-4" />
                      Confirmer le besoin
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Motif du refus ?');
                        if (reason) act(d.id, 'reject', { reason });
                      }}
                      className="btn-ghost"
                    >
                      <X className="h-4 w-4" />
                      Refuser
                    </button>
                  </>
                )}

                {isFinance && d.status === 'AMBASSADOR_CONFIRMED' && (
                  <>
                    <button
                      onClick={() => act(d.id, 'pay', { method: 'Mobile money' })}
                      disabled={!!busy}
                      className="btn-primary"
                    >
                      <Banknote className="h-4 w-4" />
                      Approuver et payer
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Motif du refus ?');
                        if (reason) act(d.id, 'reject', { reason });
                      }}
                      className="btn-ghost"
                    >
                      Refuser
                    </button>
                  </>
                )}

                {isDirector && d.status === 'AWAITING_RECEIPTS' && (
                  <button onClick={() => addReceipt(d.id)} className="btn-outline">
                    <FileUp className="h-4 w-4" />
                    Ajouter un justificatif
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
