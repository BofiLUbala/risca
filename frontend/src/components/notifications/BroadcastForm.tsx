'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Megaphone, Send } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL, type Role } from '@/lib/roles';

const BROADCAST_ROLES: Role[] = ['SUPER_ADMIN', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER'];

/**
 * Diffusion ciblée (section 11 du plan) : tous, pays, rôle ou région.
 * Un Responsable National est limité à son pays, un Chef Régional à sa région :
 * l'API impose ce périmètre, le formulaire ne propose donc que ce qui est permis.
 */
export function BroadcastForm() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const allowed = !!user && BROADCAST_ROLES.includes(user.role as Role);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [countryId, setCountryId] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: countries } = useSWR<any[]>(allowed && isAdmin && open ? '/geo/countries' : null, fetcher);
  const { data: provinces } = useSWR<any[]>(
    allowed && isAdmin && open && countryId ? `/geo/countries/${countryId}/provinces` : null,
    fetcher,
  );

  // Liste des comptes du perimetre, pour viser une seule personne.
  const { data: people } = useSWR<any[]>(allowed && open ? '/users' : null, fetcher);

  if (!allowed) return null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await api.post('/notifications/broadcast', {
        title: title.trim(),
        body: body.trim() || undefined,
        userId: userId || undefined,
        role: userId ? undefined : role || undefined,
        countryId: userId ? undefined : countryId || undefined,
        provinceId: userId ? undefined : provinceId || undefined,
      });
      setFeedback({
        ok: true,
        text: userId
          ? 'Notification envoyée à cette personne.'
          : 'Notification envoyée aux destinataires ciblés.',
      });
      setUserId('');
      setTitle('');
      setBody('');
    } catch (err: any) {
      setFeedback({ ok: false, text: err?.message ?? "L'envoi a échoué." });
    }
    setBusy(false);
  }

  const scope = isAdmin
    ? 'Tout le réseau, ou ciblé par pays, province et rôle.'
    : user?.role === 'NATIONAL_MANAGER'
      ? 'Limité aux utilisateurs de votre pays.'
      : 'Limité aux utilisateurs de votre région.';

  return (
    <section className="card card-pad">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-risac-50 text-risac-600">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <h2 className="card-title">Envoyer une notification</h2>
            <p className="text-xs text-ink-500">{scope}</p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn-outline" aria-expanded={open}>
          {open ? 'Fermer' : 'Nouvelle diffusion'}
        </button>
      </div>

      {open && (
        <form onSubmit={send} className="mt-5 space-y-4">
          <div>
            <label htmlFor="bc-title" className="label">
              Titre
            </label>
            <input
              id="bc-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={120}
              placeholder="Maintenance prévue samedi à 22 h"
            />
          </div>

          <div>
            <label htmlFor="bc-user" className="label">
              Une seule personne (facultatif)
            </label>
            <select
              id="bc-user"
              className="input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Aucune — utiliser les filtres ci-dessous</option>
              {people?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} · {ROLE_LABEL[u.role as Role]}
                </option>
              ))}
            </select>
            {userId && (
              <p className="meta mt-1.5">
                Les filtres pays, province et rôle sont ignorés : seule cette personne
                recevra la notification.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="bc-body" className="label">
              Message (facultatif)
            </label>
            <textarea
              id="bc-body"
              className="input min-h-[96px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={600}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="bc-role" className="label">
                Rôle
              </label>
              <select id="bc-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Tous les rôles</option>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <>
                <div>
                  <label htmlFor="bc-country" className="label">
                    Pays
                  </label>
                  <select
                    id="bc-country"
                    className="input"
                    value={countryId}
                    onChange={(e) => {
                      setCountryId(e.target.value);
                      setProvinceId('');
                    }}
                  >
                    <option value="">Tous les pays</option>
                    {countries?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameFr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bc-province" className="label">
                    Province
                  </label>
                  <select
                    id="bc-province"
                    className="input"
                    value={provinceId}
                    onChange={(e) => setProvinceId(e.target.value)}
                    disabled={!countryId}
                  >
                    <option value="">Toutes les provinces</option>
                    {provinces?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameFr}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {feedback && (
            <p
              role="status"
              className={`rounded-xl px-4 py-3 text-sm ${
                feedback.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}
            >
              {feedback.text}
            </p>
          )}

          <button type="submit" disabled={busy || title.trim().length < 3} className="btn-primary">
            <Send className="h-4 w-4" />
            {busy ? 'Envoi…' : 'Envoyer'}
          </button>
        </form>
      )}
    </section>
  );
}
