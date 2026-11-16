'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { X } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { t as tx, localized } from '@/lib/i18n';

const TYPES: Array<{ value: string; label: string }> = localized([
  { value: 'GENERAL', label: 'Général (tout le réseau)' },
  { value: 'REGIONAL', label: 'Région' },
  { value: 'AMBASSADOR_REGIONAL', label: 'Ambassadeurs de la région' },
  { value: 'AMBASSADOR_NATIONAL', label: 'Ambassadeurs du pays' },
  { value: 'AMBASSADOR_ORPHANAGE', label: 'Orphelinat' },
  { value: 'PARTNERS', label: 'Partenaires' },
]);

/**
 * Création d'un canal de discussion par un Super Admin, un Modérateur, un Responsable National ou un Chef Régional.
 * Les membres proposés sont ceux que la hiérarchie permet de voir (la liste /users est déjà filtrée par l'API).
 */
export function NewChannel({ onCreated, onClose }: { onCreated: (id: string) => void; onClose: () => void }) {
  const { user } = useAuth();
  const { data: people } = useSWR<any[]>('/users', fetcher);

  const [name, setName] = useState('');
  const [type, setType] = useState('GENERAL');
  const [description, setDescription] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (people ?? [])
      .filter((p) => p.id !== user?.id && p.status !== 'INVITED')
      .filter((p) => !needle || `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(needle));
  }, [people, q, user?.id]);

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError(tx("Donnez un nom au canal."));
    setBusy(true);
    try {
      const ch = await api.post<{ id: string }>('/channels', {
        type,
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: Array.from(picked),
      });
      onCreated(ch.id);
    } catch (err: any) {
      setError(err?.message ?? tx("Création impossible"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="nc-title">
      <form onSubmit={submit} className="card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden" noValidate>
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h2 id="nc-title" className="text-sm font-semibold text-ink-900">
            {tx("Nouveau canal")}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost h-8 w-8 p-0" aria-label={tx("Fermer")}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="nc-name" className="label">
              {tx("Nom du canal")}
            </label>
            <input id="nc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nc-type" className="label">
                {tx("Type")}
              </label>
              <select id="nc-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nc-desc" className="label">
                {tx("Description (facultatif)")}
              </label>
              <input id="nc-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} />
            </div>
          </div>

          <div>
            <label htmlFor="nc-search" className="label">
              {tx("Membres (")}{picked.size}{' '}{tx("choisi")}{picked.size > 1 ? 's' : ''}{tx(") · vous en faites partie")}
            </label>
            <input id="nc-search" className="input" placeholder={tx("Rechercher un nom ou un e-mail")} value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="mt-2 max-h-56 divide-y divide-ink-100 overflow-y-auto rounded-xl border border-ink-100">
              {!people ? (
                <li className="px-3.5 py-3 text-sm text-ink-500">{tx("Chargement…")}</li>
              ) : !list.length ? (
                <li className="px-3.5 py-3 text-sm text-ink-500">{tx("Aucun compte à ajouter.")}</li>
              ) : (
                list.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-ink-50">
                      <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 rounded border-ink-300" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-900">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="block truncate text-xs text-ink-500">{ROLE_LABEL[p.role as Role]}</span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3.5">
          <button type="button" onClick={onClose} className="btn-ghost">
            {tx("Annuler")}
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? tx("Création…") : tx("Créer le canal")}
          </button>
        </footer>
      </form>
    </div>
  );
}
