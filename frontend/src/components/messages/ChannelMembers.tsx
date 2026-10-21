'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { UserMinus, UserPlus, Users } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_LABEL, type Role } from '@/lib/roles';

/**
 * Membres d’un canal : liste, ajout et retrait. Reserve au Super Admin, au
 * Modérateur, au Responsable National et au Chef Régional
 * (`POST /channels/:id/members`, `DELETE /channels/:id/members/:userId`).
 */
export function ChannelMembers({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const { data: channel, isLoading, mutate } = useSWR<any>(`/channels/${channelId}`, fetcher);
  const { data: users } = useSWR<any[]>('/users', fetcher);
  const [addId, setAddId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberIds = new Set((channel?.members ?? []).map((m: any) => m.userId));

  async function add() {
    if (!addId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/channels/${channelId}/members`, { userId: addId, canWrite: true });
      setAddId('');
      mutate();
    } catch (e: any) {
      setError(e?.message ?? 'L’ajout a échoué.');
    }
    setBusy(false);
  }

  async function remove(userId: string, name: string) {
    if (!window.confirm(`Retirer ${name} de ce canal ?`)) return;
    setError(null);
    try {
      await api.del(`/channels/${channelId}/members/${userId}`);
      mutate();
    } catch (e: any) {
      setError(e?.message ?? 'Le retrait a échoué.');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
        <Users className="h-4 w-4 text-ink-400" aria-hidden />
        <h2 className="flex-1 text-sm font-semibold text-ink-900">
          Membres{channel ? ` (${channel.members?.length ?? 0})` : ''}
        </h2>
        <button type="button" onClick={onClose} className="btn-ghost px-2 text-xs">
          Fermer
        </button>
      </div>

      <div className="border-b border-ink-100 p-3">
        <label htmlFor="add-member" className="label">
          Ajouter un membre
        </label>
        <div className="flex gap-2">
          <select
            id="add-member"
            className="input flex-1"
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
          >
            <option value="">Choisir une personne</option>
            {users
              ?.filter((u) => !memberIds.has(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} · {ROLE_LABEL[u.role as Role]}
                </option>
              ))}
          </select>
          <button type="button" onClick={add} disabled={!addId || busy} aria-busy={busy} className="btn-primary px-3">
            <UserPlus className="h-4 w-4" />
            <span className="sr-only">Ajouter</span>
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-rose-700">
            {error}
          </p>
        )}
      </div>

      <ul className="flex-1 divide-y divide-ink-50 overflow-y-auto">
        {isLoading && <li className="p-4 text-xs text-ink-400">Chargement…</li>}
        {channel?.members?.map((m: any) => (
          <li key={m.userId} className="flex items-center gap-2.5 px-4 py-2.5">
            <Avatar src={m.user?.avatarUrl} firstName={m.user?.firstName} lastName={m.user?.lastName} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink-900">
                {m.user?.firstName} {m.user?.lastName}
              </p>
              <p className="truncate meta">
                {ROLE_LABEL[m.user?.role as Role]}
                {m.canWrite === false ? ' · lecture seule' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(m.userId, `${m.user?.firstName} ${m.user?.lastName}`)}
              className="btn-ghost h-8 w-8 shrink-0 p-0"
              aria-label={`Retirer ${m.user?.firstName} ${m.user?.lastName}`}
            >
              <UserMinus className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
