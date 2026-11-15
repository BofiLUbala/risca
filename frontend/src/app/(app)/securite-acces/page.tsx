'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Activity, Lock, ShieldAlert, Smartphone, Trash2, X } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { confirmDialog } from '@/lib/dialog';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { dateTime } from '@/lib/format';
import { ROLE_LABEL, type Role } from '@/lib/roles';

type Person = { id: string; name: string | null; email: string; role: Role; adminRank: number | null };
type Session = {
  id: string;
  user: Person;
  device: string;
  ip: string | null;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  durationSeconds: number;
  online: boolean;
};
type Failure = {
  id: string;
  at: string;
  type: 'FAILED' | 'BLOCKED';
  user: Person | null;
  email: string | null;
  attempt: number | null;
  reason: string | null;
  lockedAfter: boolean;
  device: string;
  ip: string | null;
};
type Locked = { id: string; name: string | null; email: string; role: Role; adminRank: number | null; failedLoginCount: number; lockedUntil: string };
type Overview = {
  onlineNow: Session[];
  recentSessions: Session[];
  failedAttempts: Failure[];
  lockedAccounts: Locked[];
  summary: { online: number; failedLast24h: number; locked: number };
  policy: { maxAttempts: number; lockMinutes: number };
};

const REASON: Record<string, string> = {
  BAD_PASSWORD: 'Mot de passe incorrect',
  BAD_ADMIN_KEY: 'Clé administrateur incorrecte',
  BAD_TOTP: 'Code de double authentification incorrect',
  UNKNOWN_ACCOUNT: 'Adresse inconnue',
  ACCOUNT_LOCKED: 'Compte déjà bloqué',
};

/** « 2 h 05 min », « 12 min », « 40 s ». */
function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')} min`;
}

function who(p: Person | null, email: string | null) {
  if (!p) return { name: email ?? 'Inconnu', sub: 'Aucun compte à cette adresse' };
  const rank = p.role === 'SUPER_ADMIN' && p.adminRank ? ` n°${p.adminRank}` : '';
  return { name: p.name || p.email, sub: `${p.email} · ${ROLE_LABEL[p.role]}${rank}` };
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="card card-pad flex items-center gap-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <div>
        <p className="text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
        <p className="text-sm text-ink-500">{label}</p>
      </div>
    </div>
  );
}

/** Bouton « Retirer » d'une ligne. */
function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="-my-1 ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-400 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40"
      aria-label={label}
      title={label}
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** En-tête de section avec, à droite, le bouton qui la vide. */
function SectionHeader({ id, title, action }: { id: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="text-sm font-semibold text-ink-900">
        {title}
      </h2>
      {action}
    </div>
  );
}

function ClearButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn-outline h-9 gap-1.5 px-3 text-xs text-rose-700 disabled:opacity-50">
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </button>
  );
}

function SessionList({
  rows,
  empty,
  onRemove,
  busy,
}: {
  rows: Session[];
  empty: string;
  onRemove?: (s: Session) => void;
  busy?: string | null;
}) {
  if (!rows.length) return <Empty icon={<Activity className="h-6 w-6" />} title={empty} />;
  return (
    <div className="card divide-y divide-ink-100 overflow-hidden">
      {rows.map((s) => {
        const w = who(s.user, null);
        return (
          <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 sm:px-5">
            <div className="min-w-0 flex-1 basis-60">
              <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${s.online ? 'bg-emerald-500' : 'bg-ink-300'}`}
                  role="img"
                  aria-label={s.online ? 'En ligne' : 'Hors ligne'}
                />
                <span className="truncate">{w.name}</span>
              </p>
              <p className="break-words text-xs text-ink-500">{w.sub}</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-ink-700">
              <Smartphone className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
              {s.device}
            </div>
            <div className="text-xs text-ink-500 sm:w-44">
              <p>Connecté {dateTime(s.startedAt)}</p>
              <p>
                {s.online ? 'En ligne depuis ' : 'Resté connecté '}
                <strong className="font-semibold text-ink-700">{duration(s.durationSeconds)}</strong>
              </p>
            </div>
            <p className="text-xs tabular-nums text-ink-400 sm:w-28">{s.ip ?? ''}</p>
            {onRemove ? (
              <div className="ml-auto w-9 shrink-0">
                {/* Une connexion en cours ne se retire pas : personne n'est déconnecté depuis cette page. */}
                {!s.online ? (
                  <RemoveButton label={`Retirer la connexion de ${w.name} du ${dateTime(s.startedAt)}`} onClick={() => onRemove(s)} disabled={!!busy} />
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function SecuriteAccesPage() {
  const { data, isLoading, mutate } = useSWR<Overview>('/auth/admin/security', fetcher, { refreshInterval: 15000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  /** Toute remise à zéro est confirmée, puis tracée au journal d'audit par l'API. */
  async function run(key: string, question: string, path: string, done: (res: { cleared?: number }) => string) {
    if (!(await confirmDialog(question))) return;
    setBusy(key);
    setNotice(null);
    try {
      const res = await api.del<{ cleared?: number }>(path);
      setNotice({ ok: true, text: done(res ?? {}) });
      await mutate();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'L’opération a échoué.' });
    }
    setBusy(null);
  }

  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

  const clearFailures = () =>
    run(
      'failures',
      'Effacer toutes les tentatives de connexion échouées de cette page ?\n\nElles restent dans le journal d’audit. Les comptes bloqués le restent jusqu’à la fin de leur blocage.',
      '/auth/admin/security/failed-attempts',
      (r) => `${plural(r.cleared ?? 0, 'tentative échouée effacée', 'tentatives échouées effacées')} de la page.`,
    );

  const dismissFailure = (f: Failure) =>
    run(
      `failure:${f.id}`,
      `Retirer cette tentative échouée (${who(f.user, f.email).name}, ${dateTime(f.at)}) de la page ?`,
      `/auth/admin/security/failed-attempts/${f.id}`,
      () => 'Tentative retirée de la page.',
    );

  const clearHistory = () =>
    run(
      'sessions',
      'Effacer l’historique des connexions terminées ?\n\nLes connexions en cours restent affichées et personne n’est déconnecté.',
      '/auth/admin/security/sessions',
      (r) => `${plural(r.cleared ?? 0, 'connexion retirée', 'connexions retirées')} de l’historique.`,
    );

  const hideSession = (s: Session) =>
    run(
      `session:${s.id}`,
      `Retirer la connexion de ${who(s.user, null).name} du ${dateTime(s.startedAt)} de l’historique ?`,
      `/auth/admin/security/sessions/${s.id}`,
      () => 'Connexion retirée de l’historique.',
    );

  const finishedSessions = data?.recentSessions.filter((s) => !s.online).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Sécurité des accès</h1>
        <p className="mt-1 text-sm text-ink-500">
          Qui est connecté, depuis quel appareil et pendant combien de temps, qui a essayé de se connecter sans y arriver.
          {data
            ? ` Au-delà de ${data.policy.maxAttempts} tentatives échouées, le compte est bloqué ${data.policy.lockMinutes / 60} h, puis la personne peut réessayer.`
            : ''}
        </p>
      </div>

      {notice ? (
        <p
          role={notice.ok ? 'status' : 'alert'}
          className={`rounded-xl px-4 py-3 text-sm ${notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
        >
          {notice.text}
        </p>
      ) : null}

      {isLoading || !data ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon={<Activity className="h-5 w-5" />} label="Connectés maintenant" value={data.summary.online} tone="bg-emerald-50 text-emerald-700" />
            <Stat icon={<ShieldAlert className="h-5 w-5" />} label="Échecs de connexion (24 h)" value={data.summary.failedLast24h} tone="bg-amber-50 text-amber-700" />
            <Stat icon={<Lock className="h-5 w-5" />} label="Comptes bloqués" value={data.summary.locked} tone="bg-rose-50 text-rose-700" />
          </div>

          <section aria-labelledby="h-online" className="space-y-3">
            <h2 id="h-online" className="text-sm font-semibold text-ink-900">
              Connectés maintenant
            </h2>
            <SessionList rows={data.onlineNow} empty="Personne n’est connecté en ce moment" />
          </section>

          <section aria-labelledby="h-locked" className="space-y-3">
            <h2 id="h-locked" className="text-sm font-semibold text-ink-900">
              Comptes bloqués
            </h2>
            {!data.lockedAccounts.length ? (
              <Empty icon={<Lock className="h-6 w-6" />} title="Aucun compte bloqué" />
            ) : (
              <div className="card divide-y divide-ink-100 overflow-hidden">
                {data.lockedAccounts.map((a) => {
                  const w = who({ id: a.id, name: a.name, email: a.email, role: a.role, adminRank: a.adminRank }, null);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{w.name}</p>
                        <p className="break-words text-xs text-ink-500">{w.sub}</p>
                      </div>
                      <p className="text-xs text-rose-700">
                        {a.failedLoginCount} échecs · bloqué jusqu’au {dateTime(a.lockedUntil)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="h-fail" className="space-y-3">
            <SectionHeader
              id="h-fail"
              title="Tentatives de connexion échouées"
              action={
                data.failedAttempts.length ? (
                  <ClearButton onClick={clearFailures} disabled={!!busy}>
                    {busy === 'failures' ? 'Effacement…' : 'Tout effacer'}
                  </ClearButton>
                ) : null
              }
            />
            {!data.failedAttempts.length ? (
              <Empty icon={<ShieldAlert className="h-6 w-6" />} title="Aucune tentative échouée" />
            ) : (
              <div className="card divide-y divide-ink-100 overflow-hidden">
                {data.failedAttempts.map((f) => {
                  const w = who(f.user, f.email);
                  return (
                    <div key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 sm:px-5">
                      <div className="min-w-0 flex-1 basis-60">
                        <p className="truncate text-sm font-medium text-ink-900">{w.name}</p>
                        <p className="break-words text-xs text-ink-500">{w.sub}</p>
                      </div>
                      <div className="text-sm text-ink-700">
                        <p>{f.type === 'BLOCKED' ? 'Refusée : compte bloqué' : REASON[f.reason ?? ''] ?? 'Échec'}</p>
                        {f.type === 'FAILED' && f.attempt ? (
                          <p className={`text-xs ${f.lockedAfter ? 'font-semibold text-rose-700' : 'text-ink-500'}`}>
                            Tentative n°{f.attempt}
                            {f.lockedAfter ? ' : compte bloqué' : ''}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-ink-700">
                        <Smartphone className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                        {f.device}
                      </div>
                      <div className="text-xs text-ink-500 sm:w-40">
                        <p>{dateTime(f.at)}</p>
                        <p className="tabular-nums text-ink-400">{f.ip ?? ''}</p>
                      </div>
                      <RemoveButton label={`Retirer la tentative de ${w.name} du ${dateTime(f.at)}`} onClick={() => dismissFailure(f)} disabled={!!busy} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="h-recent" className="space-y-3">
            <SectionHeader
              id="h-recent"
              title="Dernières connexions"
              action={
                finishedSessions ? (
                  <ClearButton onClick={clearHistory} disabled={!!busy}>
                    {busy === 'sessions' ? 'Effacement…' : 'Effacer l’historique'}
                  </ClearButton>
                ) : null
              }
            />
            <SessionList rows={data.recentSessions} empty="Aucune connexion enregistrée" onRemove={hideSession} busy={busy} />
            <p className="text-xs text-ink-400">Actualisation automatique toutes les 15 secondes.</p>
          </section>
        </>
      )}
    </div>
  );
}
