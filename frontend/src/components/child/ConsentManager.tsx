'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { date } from '@/lib/format';
import { Field } from '@/components/child/Tabs';

// Rôles qui peuvent consigner un consentement : ceux qui ont un droit d'écriture
// sur le dossier. L'Auditeur Éthique reste en lecture seule.
const WRITERS = [
  'SUPER_ADMIN',
  'REGIONAL_MANAGER',
  'AMBASSADOR',
  'ORPHANAGE_DIRECTOR',
  'ORPHANAGE_STAFF',
  'FIELD_AGENT',
];

export function ConsentManager({ child, onChange }: { child: any; onChange: () => void }) {
  const { user } = useAuth();
  const canWrite = !!user && WRITERS.includes(user.role);

  const [guardianName, setGuardianName] = useState('');
  const [childSigned, setChildSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consents: any[] = child.consents ?? [];
  const hasValid = consents.some((c) => !c.revokedAt);

  async function record(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/children/${child.id}/consent`, {
        guardianName: guardianName.trim(),
        childSigned,
      });
      setGuardianName('');
      setChildSigned(false);
      onChange();
    } catch (err: any) {
      setError(err?.message ?? "L'enregistrement a échoué.");
    }
    setBusy(false);
  }

  async function revoke(id: string) {
    if (!window.confirm('Révoquer ce consentement ? Les publications avec photo seront bloquées.')) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/children/consents/${id}/revoke`, {});
      onChange();
    } catch (err: any) {
      setError(err?.message ?? 'La révocation a échoué.');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {!hasValid && (
        <div className="card card-pad text-sm text-amber-700">
          Aucun consentement valide. Toute publication avec photo ou vidéo est bloquée.
        </div>
      )}

      {consents.map((c) => (
        <section key={c.id} className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-ink-900">{c.kind}</p>
            <div className="flex items-center gap-2">
              {c.revokedAt ? (
                <span className="chip bg-rose-50 text-rose-700">révoqué le {date(c.revokedAt)}</span>
              ) : (
                <>
                  <span className="chip bg-emerald-50 text-emerald-700">valide</span>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => revoke(c.id)}
                      disabled={busy}
                      className="btn-ghost text-rose-700"
                    >
                      <ShieldOff className="h-4 w-4" />
                      Révoquer
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <dl className="mt-2">
            <Field label="Tuteur" value={c.guardianName} />
            <Field label="Signé par le tuteur le" value={date(c.guardianSignedAt)} />
            <Field label="Signé par l'enfant le" value={date(c.childSignedAt)} />
          </dl>
        </section>
      ))}

      {canWrite && (
        <form onSubmit={record} className="card card-pad space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-risac-600" />
            <h2 className="card-title">Enregistrer un consentement photo et vidéo</h2>
          </div>
          <div>
            <label htmlFor="consent-guardian" className="label">
              Nom du tuteur ou du représentant légal
            </label>
            <input
              id="consent-guardian"
              className="input"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={childSigned}
              onChange={(e) => setChildSigned(e.target.checked)}
            />
            L'enfant a lui-même donné son accord, selon son âge.
          </label>
          <p className="text-xs text-ink-500">
            Le tuteur a signé le formulaire papier. Vous attestez l'avoir vu : votre nom est conservé comme témoin.
          </p>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || guardianName.trim().length < 2} className="btn-primary">
            {busy ? 'Enregistrement…' : 'Enregistrer le consentement'}
          </button>
        </form>
      )}
    </div>
  );
}
