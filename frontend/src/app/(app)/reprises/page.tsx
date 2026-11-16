'use client';

import { useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { Repeat } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { dateTime } from '@/lib/format';
import { t as tx, localized } from '@/lib/i18n';

type Person = { id: string; firstName: string; lastName: string };
type Item = {
  id: string;
  user: Person & { role: Role; provinceId: string | null };
  fromRole: Role;
  toRole: Role;
  promotedAt: string;
  state: 'WAITING' | 'GRANTED' | 'CLONED';
  grantedAt: string | null;
  clonedAt: string | null;
  handedOverAt: string | null;
  handedOverTo: Person | null;
  handoverSummary: Record<string, number> | null;
};

const STATE: Record<Item['state'], { label: string; tone: string }> = localized({
  WAITING: { label: 'Accord à donner', tone: 'bg-amber-50 text-amber-800' },
  GRANTED: { label: 'Accord donné', tone: 'bg-sky-50 text-sky-800' },
  CLONED: { label: 'Données clonées', tone: 'bg-emerald-50 text-emerald-800' },
});

/**
 * Promotions de mon périmètre : donner l'accord de reprise (la personne promue peut alors cloner ses données) et
 * confier les responsabilités de l'ancien rôle à un autre agent.
 */
export default function ReprisesPage() {
  const { data, isLoading, mutate } = useSWR<Item[]>('/transitions', fetcher, { refreshInterval: 30000 });
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});

  async function act(id: string, path: string, body: unknown, success: string) {
    setBusy(id);
    setNotice(null);
    try {
      await api.post(`/transitions/${id}/${path}`, body);
      setNotice({ ok: true, text: success });
      await mutate();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? tx("Action impossible") });
    }
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{tx("Reprises après promotion")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          {tx("Quand un agent est promu, donnez votre accord pour qu’il puisse cloner les données de son ancien espace, et confiez ses responsabilités en cours à un autre agent.")}
        </p>
      </div>

      {notice && (
        <p role="status" className={clsx('rounded-xl px-4 py-3 text-sm', notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700')}>
          {notice.text}
        </p>
      )}

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : !data?.length ? (
        <Empty icon={<Repeat className="h-6 w-6" />} title={tx("Aucune promotion à traiter")} description={tx("Les promotions de votre périmètre apparaîtront ici.")} />
      ) : (
        <div className="space-y-3">
          {data.map((t) => (
            <article key={t.id} className="card card-pad space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {t.user.firstName} {t.user.lastName}
                  </p>
                  <p className="text-xs text-ink-500">
                    {ROLE_LABEL[t.fromRole]} → {ROLE_LABEL[t.toRole]}{' '}{tx("· promu le")}{' '}{dateTime(t.promotedAt)}
                  </p>
                </div>
                <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-medium', STATE[t.state].tone)}>{STATE[t.state].label}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {t.state === 'WAITING' && (
                  <button type="button" disabled={busy === t.id} onClick={() => act(t.id, 'grant', {}, tx("Accord donné à {firstName} : il peut cloner ses données.", { firstName: t.user.firstName }))} className="btn-primary px-3 text-xs">
                    {tx("Donner l’accord de reprise")}
                  </button>
                )}
                {t.state !== 'WAITING' && <span className="text-xs text-ink-500">{tx("Accord donné")}{' '}{t.grantedAt ? tx("le {date}", { date: dateTime(t.grantedAt) }) : ''}</span>}
              </div>

              {t.handedOverAt ? (
                <p className="text-xs text-ink-600">
                  {tx("Responsabilités confiées à")}{' '}{t.handedOverTo?.firstName} {t.handedOverTo?.lastName}{' '}{tx("le")}{' '}{dateTime(t.handedOverAt)}
                  {t.handoverSummary
                    ? tx(" ({v0} enfant(s) suivi(s), {v1} orphelinat(s), {v2} dossier(s) en cours)", { v0: t.handoverSummary.assignments ?? 0, v1: t.handoverSummary.orphanageLinks ?? 0, v2: t.handoverSummary.childRecordsInProgress ?? 0 })
                    : ''}
                  .
                </p>
              ) : (
                <Handover item={t} value={pick[t.id] ?? ''} onChange={(v) => setPick({ ...pick, [t.id]: v })} busy={busy === t.id} onGo={() => act(t.id, 'handover', { toUserId: pick[t.id] }, tx("Responsabilités transférées."))} />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Handover({ item, value, onChange, busy, onGo }: { item: Item; value: string; onChange: (v: string) => void; busy: boolean; onGo: () => void }) {
  const { data } = useSWR<any[]>(`/users?role=${item.fromRole}`, fetcher);
  const candidates = (data ?? []).filter((u) => u.id !== item.user.id && u.status === 'ACTIVE' && u.province?.id === item.user.provinceId);
  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-ink-100 pt-3">
      <div className="min-w-[220px] flex-1">
        <label htmlFor={`h-${item.id}`} className="label">
          {tx("Confier ses responsabilités à un autre")}{' '}{ROLE_LABEL[item.fromRole].toLowerCase()}
        </label>
        <select id={`h-${item.id}`} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{tx("Choisir")}</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
      </div>
      <button type="button" disabled={!value || busy} onClick={onGo} className="btn-outline">
        {tx("Transférer")}
      </button>
    </div>
  );
}
