'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ArrowRightLeft, Check } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { date } from '@/lib/format';

const DECIDERS = ['SUPER_ADMIN', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER'];
const REQUESTERS = [...DECIDERS, 'ORPHANAGE_DIRECTOR', 'FIELD_AGENT', 'AMBASSADOR'];

/**
 * Transfert d’un enfant vers une autre structure. La demande est faite par la
 * structure d’origine ou un responsable ; seul un chef régional, le responsable
 * national ou le Super Admin la valide. À la validation, l’enfant change de
 * structure et l’ambassadeur principal de la structure d’accueil reprend le dossier.
 */
export function TransferChild({
  childId,
  currentOrphanageId,
  transfers,
  slot = 'action',
  onDone,
}: {
  childId: string;
  currentOrphanageId: string;
  transfers?: any[];
  /** `action` : bouton dans l'en-tete. `banner` : bandeau du transfert en attente. */
  slot?: 'action' | 'banner';
  onDone: () => void;
}) {
  const { user } = useAuth();
  const canRequest = !!user && REQUESTERS.includes(user.role);
  const canDecide = !!user && DECIDERS.includes(user.role);

  const [open, setOpen] = useState(false);
  const [toOrphanageId, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: orphanages, isLoading } = useSWR<any[]>(open ? '/orphanages' : null, fetcher);
  const pending = (transfers ?? []).find((t) => t.status === 'PENDING');

  if (slot === 'banner' && !pending) return null;
  if (slot === 'action' && (pending || !canRequest)) return null;

  async function request() {
    if (!toOrphanageId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/children/${childId}/transfer`, { toOrphanageId, reason: reason.trim() || undefined });
      setOpen(false);
      setTo('');
      setReason('');
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'La demande de transfert a échoué.');
    }
    setBusy(false);
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/children/transfers/${pending.id}/complete`, {});
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'La validation du transfert a échoué.');
    }
    setBusy(false);
  }

  if (pending) {
    return (
      <div className="w-full rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <p className="text-sm font-medium text-amber-900">Transfert en attente de validation</p>
        <p className="mt-1 text-xs text-amber-800">
          Demandé le {date(pending.createdAt)}
          {pending.reason ? ` · ${pending.reason}` : ''}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-rose-700">
            {error}
          </p>
        )}
        {canDecide ? (
          <button type="button" onClick={complete} disabled={busy} aria-busy={busy} className="btn-primary mt-3">
            <Check className="h-4 w-4" />
            {busy ? 'Validation…' : 'Valider le transfert'}
          </button>
        ) : (
          <p className="mt-2 text-xs text-amber-800">
            Un chef régional, le responsable national ou le Super Admin doit le valider.
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline">
        <ArrowRightLeft className="h-4 w-4" />
        Transférer
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-risac-200 bg-risac-50/60 p-4 sm:w-96">
      <label htmlFor="transfer-to" className="label">
        Structure d’accueil
      </label>
      <select
        id="transfer-to"
        className="input"
        value={toOrphanageId}
        onChange={(e) => setTo(e.target.value)}
        disabled={isLoading}
      >
        <option value="">{isLoading ? 'Chargement…' : 'Choisir une structure'}</option>
        {orphanages
          ?.filter((o) => o.id !== currentOrphanageId)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.province?.nameFr ? ` · ${o.province.nameFr}` : ''}
            </option>
          ))}
      </select>

      <label htmlFor="transfer-reason" className="label mt-3">
        Motif
      </label>
      <textarea
        id="transfer-reason"
        rows={3}
        className="input"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Pourquoi ce transfert ?"
      />

      <p className="mt-2 text-xs text-ink-500">
        La demande reste en attente jusqu’à la validation d’un chef régional. L’historique du dossier
        suit l’enfant.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={request} disabled={!toOrphanageId || busy} aria-busy={busy} className="btn-primary">
          {busy ? 'Envoi…' : 'Demander le transfert'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Annuler
        </button>
      </div>
    </div>
  );
}
