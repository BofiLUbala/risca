'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { UserCheck } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const ASSIGNERS = ['SUPER_ADMIN', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER'];

/**
 * Affectation d'un enfant à un ambassadeur (Super Admin, Responsable National,
 * Chef Régional). Seul l'ambassadeur assigné voit ensuite les demandes de
 * financement et gère le dossier : l'affectation précédente est désactivée.
 */
export function AssignAmbassador({
  childId,
  current,
  onDone,
}: {
  childId: string;
  current?: { id: string; firstName: string; lastName: string } | null;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const allowed = !!user && ASSIGNERS.includes(user.role);

  const [open, setOpen] = useState(false);
  const [ambassadorId, setAmbassadorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: ambassadors, isLoading } = useSWR<any[]>(allowed && open ? '/users/ambassadors' : null, fetcher);

  if (!allowed) return null;

  async function assign() {
    if (!ambassadorId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/children/${childId}/assign`, { ambassadorId });
      setOpen(false);
      setAmbassadorId('');
      onDone();
    } catch (e: any) {
      setError(e?.message ?? "L'affectation a échoué.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline">
        <UserCheck className="h-4 w-4" />
        {current ? "Changer d'ambassadeur" : 'Assigner un ambassadeur'}
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-risac-200 bg-risac-50/60 p-4 sm:w-96">
      <label htmlFor="assign-amb" className="label">
        Ambassadeur responsable
      </label>
      <select
        id="assign-amb"
        className="input"
        value={ambassadorId}
        onChange={(e) => setAmbassadorId(e.target.value)}
        disabled={isLoading}
      >
        <option value="">{isLoading ? 'Chargement…' : 'Choisir un ambassadeur'}</option>
        {ambassadors?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.firstName} {a.lastName}
            {a.province?.nameFr ? ` · ${a.province.nameFr}` : ''} · {a._count?.assignments ?? 0} enfant(s)
          </option>
        ))}
      </select>
      {!isLoading && ambassadors?.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">Aucun ambassadeur actif dans votre périmètre.</p>
      )}
      {current && (
        <p className="mt-2 text-xs text-ink-500">
          Remplace {current.firstName} {current.lastName}. L'historique de l'enfant garde la trace du changement.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={assign} disabled={!ambassadorId || busy} className="btn-primary">
          {busy ? 'Affectation…' : 'Confirmer'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Annuler
        </button>
      </div>
    </div>
  );
}
