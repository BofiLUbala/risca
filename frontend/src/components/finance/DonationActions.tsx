'use client';

import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Remboursement ou réaffectation d’un don réglé
 * (`POST /payments/donations/:id/refund`, Super Admin et Admin Finance).
 * Le remboursement rend l’argent au bailleur, la réaffectation l’envoie au fonds
 * général. Impossible si les fonds ont déjà été décaissés : l’API le refuse et le
 * motif est affiché.
 */
export function DonationActions({ donation, onDone }: { donation: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('REFUND');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seul un don réglé peut être remboursé ou réaffecté.
  if (donation.status !== 'SUCCEEDED') return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/payments/donations/${donation.id}/refund`, {
        mode,
        reason: reason.trim() || undefined,
      });
      setOpen(false);
      setReason('');
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'L’opération a échoué.');
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline px-3 text-xs">
        <Undo2 className="h-3.5 w-3.5" />
        Rembourser
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-amber-200 bg-amber-50/70 p-3">
      <fieldset>
        <legend className="label">Que faire de ce don ?</legend>
        <div className="space-y-1.5">
          {[
            { value: 'REFUND', label: 'Rembourser le bailleur' },
            { value: 'REALLOCATE', label: 'Réaffecter au fonds général' },
          ].map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-ink-800">
              <input
                type="radio"
                name={`refund-mode-${donation.id}`}
                value={o.value}
                checked={mode === o.value}
                onChange={() => setMode(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={`refund-reason-${donation.id}`} className="label mt-3">
        Motif
      </label>
      <input
        id={`refund-reason-${donation.id}`}
        className="input"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Inscrit au journal d’audit"
      />

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={submit} disabled={busy} aria-busy={busy} className="btn-primary px-3 text-xs">
          {busy ? 'Traitement…' : 'Confirmer'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-3 text-xs">
          Annuler
        </button>
      </div>
    </div>
  );
}
