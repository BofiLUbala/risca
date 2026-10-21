'use client';

import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

const KINDS = [
  { value: 'GENERAL_FUND', label: 'Fonds général' },
  { value: 'ONE_OFF', label: 'Don ponctuel à un enfant' },
  { value: 'PROJECT_CONTRIBUTION', label: 'Contribution à un projet' },
];

/**
 * Enregistrement d’un virement bancaire reçu hors plateforme
 * (`POST /payments/donations/manual-transfer`, Super Admin et Admin Finance).
 * Le don entre dans le registre comme un paiement en ligne : frais annoncés,
 * compte crédité du net, rapprochement inclus.
 */
export function ManualTransferForm({ onRecorded }: { onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    donorEmail: '',
    amount: '',
    currency: 'USD',
    kind: 'GENERAL_FUND',
    childId: '',
    projectId: '',
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const needsChild = form.kind === 'ONE_OFF';
  const needsProject = form.kind === 'PROJECT_CONTRIBUTION';
  const amount = Number(form.amount);
  const valid =
    form.donorEmail.includes('@') &&
    amount >= 1 &&
    (!needsChild || !!form.childId.trim()) &&
    (!needsProject || !!form.projectId.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await api.post<any>('/payments/donations/manual-transfer', {
        donorEmail: form.donorEmail.trim(),
        amount,
        currency: form.currency,
        kind: form.kind,
        childId: needsChild ? form.childId.trim() : undefined,
        projectId: needsProject ? form.projectId.trim() : undefined,
        note: form.note.trim() || undefined,
      });
      setNotice({
        ok: true,
        text: `Virement enregistré : ${money(r.amount ?? amount, r.currency ?? form.currency)}${
          r.reference ? ` · référence ${r.reference}` : ''
        }`,
      });
      setForm((f) => ({ ...f, amount: '', childId: '', projectId: '', note: '' }));
      onRecorded();
    } catch (err: any) {
      setNotice({ ok: false, text: err?.message ?? 'L’enregistrement a échoué.' });
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline">
        <Landmark className="h-4 w-4" />
        Enregistrer un virement
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card card-pad space-y-4">
      <div>
        <h2 className="section-title">Virement bancaire reçu</h2>
        <p className="meta mt-0.5">
          À saisir uniquement après vérification sur le relevé bancaire. Le registre traite ce don
          comme un paiement en ligne.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="mt-email" className="label">
            Adresse e-mail du bailleur
          </label>
          <input
            id="mt-email"
            type="email"
            required
            className="input"
            value={form.donorEmail}
            onChange={(e) => set('donorEmail', e.target.value)}
            placeholder="bailleur@example.org"
          />
        </div>
        <div>
          <label htmlFor="mt-kind" className="label">
            Affectation
          </label>
          <select id="mt-kind" className="input" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mt-amount" className="label">
            Montant
          </label>
          <input
            id="mt-amount"
            type="number"
            min={1}
            step="0.01"
            required
            className="input tabular-nums"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="mt-currency" className="label">
            Devise
          </label>
          <select
            id="mt-currency"
            className="input"
            value={form.currency}
            onChange={(e) => set('currency', e.target.value)}
          >
            {['USD', 'EUR', 'CDF'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {needsChild && (
          <div className="sm:col-span-2">
            <label htmlFor="mt-child" className="label">
              Identifiant de l’enfant
            </label>
            <input
              id="mt-child"
              className="input font-mono text-sm"
              value={form.childId}
              onChange={(e) => set('childId', e.target.value)}
              placeholder="Identifiant technique de la fiche enfant"
            />
          </div>
        )}
        {needsProject && (
          <div className="sm:col-span-2">
            <label htmlFor="mt-project" className="label">
              Identifiant du projet
            </label>
            <input
              id="mt-project"
              className="input font-mono text-sm"
              value={form.projectId}
              onChange={(e) => set('projectId', e.target.value)}
              placeholder="Identifiant technique du projet"
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="mt-note" className="label">
            Référence du virement
          </label>
          <input
            id="mt-note"
            className="input"
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Numéro d’opération sur le relevé"
          />
        </div>
      </div>

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

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!valid || busy} aria-busy={busy} className="btn-primary">
          {busy ? 'Enregistrement…' : 'Enregistrer le virement'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Fermer
        </button>
      </div>
    </form>
  );
}
