'use client';

import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/** Nature de l’événement, telle qu’attendue par l’API. */
const KINDS = [
  { value: 'VISIT', label: 'Visite' },
  { value: 'AUDIT', label: 'Audit' },
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'TRAINING', label: 'Formation' },
  { value: 'OTHER', label: 'Autre' },
];

/** Rôles autorisés à consigner un événement sur une structure. */
const WRITERS = [
  'SUPER_ADMIN',
  'NATIONAL_MANAGER',
  'REGIONAL_MANAGER',
  'AMBASSADOR',
  'FIELD_AGENT',
  'ORPHANAGE_DIRECTOR',
];

/**
 * Ajout d’un événement à l’historique d’une structure
 * (`POST /orphanages/:id/history`) : visite, audit, incident, formation.
 */
export function HistoryForm({ orphanageId, onAdded }: { orphanageId: string; onAdded: () => void }) {
  const { user } = useAuth();
  const allowed = !!user && WRITERS.includes(user.role);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('VISIT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!allowed) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/orphanages/${orphanageId}/history`, {
        kind,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setOpen(false);
      onAdded();
    } catch (err: any) {
      setError(err?.message ?? 'L’enregistrement a échoué.');
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-outline">
        <CalendarPlus className="h-4 w-4" />
        Consigner un événement
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-risac-200 bg-risac-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div>
          <label htmlFor={`hist-kind-${orphanageId}`} className="label">
            Nature
          </label>
          <select
            id={`hist-kind-${orphanageId}`}
            className="input"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`hist-title-${orphanageId}`} className="label">
            Intitulé
          </label>
          <input
            id={`hist-title-${orphanageId}`}
            className="input"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Visite trimestrielle de suivi"
          />
        </div>
      </div>

      <label htmlFor={`hist-desc-${orphanageId}`} className="label mt-3">
        Compte rendu
      </label>
      <textarea
        id={`hist-desc-${orphanageId}`}
        rows={3}
        className="input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ce qui a été constaté sur place"
      />

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={!title.trim() || busy} aria-busy={busy} className="btn-primary">
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Annuler
        </button>
      </div>
    </form>
  );
}
