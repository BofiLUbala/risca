'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { History } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { dateTime } from '@/lib/format';

/** Libellés des champs du dossier, pour ne pas afficher les noms techniques. */
const FIELD_LABEL: Record<string, string> = {
  firstName: 'Prénom',
  lastName: 'Nom',
  birthDate: 'Date de naissance',
  gender: 'Sexe',
  status: 'Statut',
  orphanageId: 'Structure',
  story: 'Récit',
  needs: 'Besoins',
  dossierData: 'Dossier pays',
  warOrphan: 'Orphelin de guerre',
  displaced: 'Déplacé',
  abandoned: 'Abandonné',
  formerArmedGroup: 'Ancien enfant associé aux groupes armés',
  photoUrl: 'Photo',
  publicPhotoUrl: 'Photo publique',
};

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') return JSON.stringify(value, null, 1);
  return String(value);
}

/**
 * Historique des versions du dossier et comparaison de deux versions
 * (`GET /children/:id/versions` et `GET /children/:id/diff`).
 */
export function VersionHistory({ childId }: { childId: string }) {
  const { data: versions, isLoading } = useSWR<any[]>(`/children/${childId}/versions`, fetcher);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [diff, setDiff] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Par défaut : la version précédente comparée à la plus récente.
  useEffect(() => {
    if (!versions?.length || from !== null) return;
    setTo(versions[0].version);
    setFrom(versions[1]?.version ?? versions[0].version);
  }, [versions, from]);

  async function compare() {
    if (from === null || to === null) return;
    setBusy(true);
    setError(null);
    setDiff(null);
    try {
      const r = await api.get<any>(`/children/${childId}/diff?from=${from}&to=${to}`);
      setDiff(r);
    } catch (e: any) {
      setError(e?.message ?? 'La comparaison a échoué.');
    }
    setBusy(false);
  }

  if (isLoading) return <SkeletonList rows={4} />;
  if (!versions?.length) {
    return <Empty icon={<History className="h-6 w-6" />} title="Aucune version enregistrée" />;
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <h2 className="section-title">Comparer deux versions</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[140px] flex-1">
            <label htmlFor="diff-from" className="label">
              Version de départ
            </label>
            <select
              id="diff-from"
              className="input"
              value={from ?? ''}
              onChange={(e) => setFrom(Number(e.target.value))}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.version}>
                  v{v.version} · {dateTime(v.createdAt)}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label htmlFor="diff-to" className="label">
              Version comparée
            </label>
            <select
              id="diff-to"
              className="input"
              value={to ?? ''}
              onChange={(e) => setTo(Number(e.target.value))}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.version}>
                  v{v.version} · {dateTime(v.createdAt)}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={compare} disabled={busy} aria-busy={busy} className="btn-primary">
            {busy ? 'Comparaison…' : 'Comparer'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {error}
          </p>
        )}
      </div>

      {diff && (
        <div className="card overflow-hidden">
          <div className="border-b border-ink-100 px-4 py-3 sm:px-5">
            <h2 className="section-title">
              Différences entre la v{diff.from} et la v{diff.to}
            </h2>
            <p className="meta mt-0.5">
              {diff.changes.length === 0
                ? 'Aucun changement entre ces deux versions.'
                : `${diff.changes.length} champ(s) modifié(s)`}
            </p>
          </div>
          {diff.changes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left">
                    <th className="table-head px-4 py-2 sm:px-5">Champ</th>
                    <th className="table-head px-4 py-2">Avant</th>
                    <th className="table-head px-4 py-2 sm:px-5">Après</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {diff.changes.map((c: any) => (
                    <tr key={c.field}>
                      <td className="px-4 py-2.5 font-medium text-ink-800 sm:px-5">
                        {FIELD_LABEL[c.field] ?? c.field}
                      </td>
                      <td className="whitespace-pre-wrap break-words px-4 py-2.5 text-ink-500">{show(c.before)}</td>
                      <td className="whitespace-pre-wrap break-words px-4 py-2.5 text-ink-900 sm:px-5">
                        {show(c.after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card divide-y divide-ink-100 overflow-hidden">
        {versions.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
            <span className="chip bg-ink-100 text-ink-600">v{v.version}</span>
            <span className="text-sm text-ink-800">{dateTime(v.createdAt)}</span>
            {v.changeNote && <span className="meta w-full sm:w-auto">{v.changeNote}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
