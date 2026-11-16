'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Archive, CheckCircle2, Clock, Copy } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';

type Mine = {
  id: string;
  fromRole: Role;
  toRole: Role;
  promotedAt: string;
  state: 'WAITING' | 'GRANTED' | 'CLONED';
  grantedAt: string | null;
  grantedBy: { firstName: string; lastName: string } | null;
  clonedAt: string | null;
  handedOverAt: string | null;
  handedOverTo: { firstName: string; lastName: string } | null;
};

/**
 * Fenêtre de reprise de l'ancien espace, sur le tableau de bord de n'importe quel rôle après une promotion.
 * Deux conditions pour cloner : avoir été promu, et que le chef régional ou national ait donné son accord.
 */
export function TransitionCard() {
  const { data, mutate } = useSWR<Mine | null>('/transitions/mine', fetcher, { refreshInterval: 30000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  async function clone() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/transitions/${data.id}/clone`, {});
      await mutate();
    } catch (e: any) {
      setError(e?.message ?? t("Clonage impossible"));
    }
    setBusy(false);
  }

  const who = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : '');

  return (
    <section aria-labelledby="h-transition" className="card card-pad border-sun-200 bg-sun-50/40">
      <h2 id="h-transition" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Archive className="h-4 w-4" aria-hidden="true" />
        {t("Votre ancien espace")}
      </h2>
      <p className="mt-1.5 text-sm text-ink-700">
        {t("Vous avez été promu :")}{' '}{ROLE_LABEL[data.fromRole]} → <strong>{ROLE_LABEL[data.toRole]}</strong>{' '}{t("le")}{' '}{dateTime(data.promotedAt)}{t(". Votre tableau de bord a changé ; vos données de l’ancien rôle (publications et photos, responsabilités, tâches, historique) restent récupérables.")}
      </p>

      {data.state === 'WAITING' && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-white/70 px-3.5 py-3 text-sm text-ink-700">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          {t("En attente de l’accord de votre chef régional ou national : dès qu’il l’aura donné, vous pourrez cloner vos données ici.")}
        </p>
      )}

      {data.state === 'GRANTED' && (
        <div className="mt-3 space-y-2">
          <p className="flex items-start gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t("Accord donné par")}{' '}{who(data.grantedBy)}{t(". Vous pouvez cloner les données de votre ancien espace.")}
          </p>
          <button type="button" onClick={clone} disabled={busy} className="btn-primary">
            <Copy className="h-4 w-4" aria-hidden="true" />
            {busy ? t("Clonage…") : t("Cloner mes données")}
          </button>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
      )}

      {data.state === 'CLONED' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-emerald-800">{t("Données clonées le")}{' '}{dateTime(data.clonedAt)}.</p>
          <Link href="/ancien-espace" className="btn-outline px-3 text-xs">
            {t("Voir mon ancien espace")}
          </Link>
        </div>
      )}

      {data.handedOverAt && (
        <p className="mt-3 text-xs text-ink-500">
          {t("Vos responsabilités en cours ont été confiées à")}{' '}{who(data.handedOverTo)}{' '}{t("le")}{' '}{dateTime(data.handedOverAt)}.
        </p>
      )}
    </section>
  );
}
