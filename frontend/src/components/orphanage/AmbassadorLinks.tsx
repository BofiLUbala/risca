'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Star, UserMinus, UserPlus } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const MANAGERS = ['SUPER_ADMIN', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER'];

/**
 * Ambassadeurs rattachés à une structure : liste, rattachement et retrait
 * (`POST /orphanages/:id/ambassadors`, `DELETE /orphanages/:id/ambassadors/:id`).
 * L’ambassadeur principal est celui qui reprend les dossiers lors d’un transfert
 * d’enfant vers cette structure. Les contrôles n’apparaissent que pour le Super
 * Admin, le Responsable National et le Chef Régional.
 */
export function AmbassadorLinks({
  orphanageId,
  links,
  onChange,
}: {
  orphanageId: string;
  links?: any[];
  onChange: () => void;
}) {
  const { user } = useAuth();
  const allowed = !!user && MANAGERS.includes(user.role);

  const [ambassadorId, setAmbassadorId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: ambassadors, isLoading } = useSWR<any[]>(allowed ? '/users/ambassadors' : null, fetcher);
  const linked = links ?? [];
  const linkedIds = new Set(linked.map((l: any) => l.ambassadorId));

  async function link() {
    if (!ambassadorId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/orphanages/${orphanageId}/ambassadors`, { ambassadorId, isPrimary });
      setAmbassadorId('');
      setIsPrimary(false);
      onChange();
    } catch (e: any) {
      setError(e?.message ?? 'Le rattachement a échoué.');
    }
    setBusy(false);
  }

  async function unlink(id: string, name: string) {
    if (!window.confirm(`Retirer ${name} de cette structure ?`)) return;
    setError(null);
    try {
      await api.del(`/orphanages/${orphanageId}/ambassadors/${id}`);
      onChange();
    } catch (e: any) {
      setError(e?.message ?? 'Le retrait a échoué.');
    }
  }

  return (
    <div>
      {linked.length === 0 ? (
        <p className="text-sm text-ink-400">Aucun ambassadeur rattaché.</p>
      ) : (
        <ul className="space-y-1.5">
          {linked.map((l: any) => {
            const name = l.user ? `${l.user.firstName} ${l.user.lastName}` : l.ambassadorId;
            return (
              <li key={l.id ?? l.ambassadorId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{name}</span>
                {l.isPrimary && (
                  <span className="chip bg-risac-50 text-risac-700">
                    <Star className="h-3 w-3" aria-hidden />
                    Principal
                  </span>
                )}
                {allowed && (
                  <button
                    type="button"
                    onClick={() => unlink(l.ambassadorId, name)}
                    className="btn-ghost h-8 w-8 shrink-0 p-0"
                    aria-label={`Retirer ${name}`}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {allowed && (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <label htmlFor={`link-amb-${orphanageId}`} className="label">
            Rattacher un ambassadeur
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              id={`link-amb-${orphanageId}`}
              className="input min-w-[180px] flex-1"
              value={ambassadorId}
              onChange={(e) => setAmbassadorId(e.target.value)}
              disabled={isLoading}
            >
              <option value="">{isLoading ? 'Chargement…' : 'Choisir un ambassadeur'}</option>
              {ambassadors
                ?.filter((a) => !linkedIds.has(a.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}
                    {a.province?.nameFr ? ` · ${a.province.nameFr}` : ''}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={link}
              disabled={!ambassadorId || busy}
              aria-busy={busy}
              className="btn-primary"
            >
              <UserPlus className="h-4 w-4" />
              Rattacher
            </button>
          </div>

          <label className="mt-2 flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            Ambassadeur principal de la structure
          </label>

          {error && (
            <p role="alert" className="mt-2 text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
