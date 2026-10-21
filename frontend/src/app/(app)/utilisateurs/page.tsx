'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Search, UserCog, UserPlus } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { dateTime } from '@/lib/format';
import { InviteForm } from '@/components/users/InviteForm';
import { UserActions } from '@/components/users/UserActions';

export default function UsersPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [invite, setInvite] = useState(false);

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (role) params.set('role', role);

  const { data, isLoading, mutate } = useSWR<any[]>(`/users?${params.toString()}`, fetcher);

  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function resend(u: any) {
    setNotice(null);
    try {
      const r = await api.post<any>(`/auth/invite/${u.id}/resend`, {});
      setNotice(
        r.emailSent !== false
          ? { ok: true, text: `Un nouveau code et un nouveau lien ont été envoyés à ${u.email}.` }
          : { ok: false, text: `L’e-mail n’a pas pu être envoyé à ${u.email}. Vérifiez l’adresse.` },
      );
      mutate();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'Le renvoi a échoué.' });
    }
  }

  async function setStatus(id: string, status: string) {
    const reason = window.prompt('Motif ?') ?? undefined;
    await api.patch(`/users/${id}/status`, { status, reason });
    mutate();
  }

  const canInvite = ['SUPER_ADMIN', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'ORPHANAGE_DIRECTOR'].includes(
    user?.role ?? '',
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="mt-1 text-sm text-ink-500">
            {data ? `${data.length} compte(s) dans votre périmètre` : 'Chargement...'}
          </p>
        </div>
        {canInvite && (
          <button onClick={() => setInvite((s) => !s)} className="btn-primary">
            <UserPlus className="h-4 w-4" />
            Inviter
          </button>
        )}
      </div>

      {invite && <InviteForm onInvited={() => mutate()} />}

      {notice && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${
            notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="card card-pad flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom ou e-mail"
            className="input pl-10"
            aria-label="Rechercher"
          />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="input sm:w-60" aria-label="Rôle">
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : !data?.length ? (
        <Empty icon={<UserCog className="h-6 w-6" />} title="Aucun utilisateur" />
      ) : (
        <div className="card divide-y divide-ink-100 overflow-hidden">
          {data.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5">
              <Avatar src={u.avatarUrl} firstName={u.firstName} lastName={u.lastName} size="sm" />
              {/* Sur téléphone l'identité garde toute la largeur : jamais de nom ni d'e-mail coupé. */}
              <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-0">
                <p className="text-sm font-medium text-ink-900 sm:truncate">
                  {u.firstName} {u.lastName}
                </p>
                <p className="break-words text-xs text-ink-500 sm:truncate">
                  {u.email} &middot; {ROLE_LABEL[u.role as Role]}
                  {u.orphanage ? ` - ${u.orphanage.name}` : ''}
                  {u.province ? ` - ${u.province.nameFr}` : ''}
                </p>
              </div>
              <span className="hidden text-xs text-ink-500 sm:block">
                {u.lastLoginAt ? dateTime(u.lastLoginAt) : 'jamais connecté'}
              </span>
              <div className="flex w-full flex-wrap items-center gap-2 pl-11 sm:w-auto sm:pl-0">
                <Badge status={u.status} />
                {canInvite && u.status === 'INVITED' && u.role !== 'DONOR' && (
                  <button type="button" onClick={() => resend(u)} className="btn-outline px-3 text-xs">
                    Renvoyer le code
                  </button>
                )}
                {['SUPER_ADMIN', 'MODERATOR', 'NATIONAL_MANAGER'].includes(user?.role ?? '') &&
                  u.id !== user?.id && (
                    <select
                      onChange={(e) => e.target.value && setStatus(u.id, e.target.value)}
                      value=""
                      className="input w-36 py-0 text-xs"
                      aria-label={`Changer le statut de ${u.firstName} ${u.lastName}`}
                    >
                      <option value="">Action</option>
                      <option value="ACTIVE">Réactiver</option>
                      <option value="SUSPENDED">Suspendre</option>
                      <option value="BLOCKED">Bloquer</option>
                    </select>
                  )}
                <UserActions target={u} onDone={() => mutate()} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
