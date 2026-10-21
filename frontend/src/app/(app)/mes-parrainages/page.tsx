'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { MessageCircle, Pause, Play, Sparkles, X } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';
import { date, money } from '@/lib/format';

const SCOPE_LABEL: Record<string, string> = {
  EDUCATION: 'Etudes',
  HEALTH: 'Santé',
  LIVING: 'Vie quotidienne',
  FULL: 'Soutien complet',
};

const RULE_LABEL: Record<string, string> = {
  FIXED_MONTHS: 'Duree fixe',
  UNTIL_18: 'Jusqu a 18 ans',
  END_OF_STUDIES: 'Fin des études',
};

export default function MySponsorshipsPage() {
  const { data, isLoading, mutate } = useSWR<any[]>('/payments/sponsorships/mine', fetcher);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, path: string) {
    setBusy(id);
    setError(null);
    try {
      await api.post(`/payments/sponsorships/${id}/${path}`, {});
      mutate();
    } catch (e: any) {
      setError(e?.message ?? 'Action impossible');
    }
    setBusy(null);
  }

  async function changeAmount(id: string, current: number) {
    const value = window.prompt('Nouveau montant mensuel (USD) ?', String(current));
    if (!value) return;
    setBusy(id);
    try {
      await api.patch(`/payments/sponsorships/${id}`, { monthlyAmount: Number(value) });
      mutate();
    } catch (e: any) {
      setError(e?.message ?? 'Modification impossible');
    }
    setBusy(null);
  }

  async function openChannel(childId: string) {
    try {
      await api.post(`/channels/donor/${childId}`, {});
      window.location.href = '/messages';
    } catch (e: any) {
      setError(e?.message ?? 'Canal indisponible');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Mes parrainages</h1>
        <p className="mt-1 text-sm text-ink-500">
          Modifiable, en pause ou annulable a tout moment. Le prelevement est mensuel.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : !data?.length ? (
        <Empty
          icon={<Sparkles className="h-6 w-6" />}
          title="Aucun parrainage"
          description="Parrainez un enfant pour soutenir ses études, sa santé ou sa vie quotidienne."
          action={
            <Link href="/enfants-a-soutenir" className="btn-primary">
              Choisir un enfant
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {data.map((s) => (
            <article key={s.id} className="card card-pad">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar src={s.child.publicPhotoUrl} firstName={s.child.firstName} size="lg" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/enfants-a-soutenir/${s.child.id}`}
                      className="text-base font-semibold text-ink-900 hover:text-risac-700"
                    >
                      {s.child.firstName}
                    </Link>
                    <Badge status={s.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {s.child.orphanage?.name}
                    {s.child.orphanage?.province ? ` - ${s.child.orphanage.province.nameFr}` : ''}
                  </p>
                  <p className="mt-2 text-sm text-ink-600">
                    {money(s.monthlyAmount, s.currency)} par mois &middot;{' '}
                    {SCOPE_LABEL[s.scope] ?? s.scope} &middot; {RULE_LABEL[s.endRule] ?? s.endRule}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Depuis le {date(s.startDate)}
                    {s.endDate ? ` - jusqu au ${date(s.endDate)}` : ''}
                    {s.nextChargeAt ? ` - prochaine echeance le ${date(s.nextChargeAt)}` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                <button
                  onClick={() => changeAmount(s.id, s.monthlyAmount)}
                  disabled={busy === s.id}
                  className="btn-outline"
                >
                  Modifier le montant
                </button>

                {s.status === 'ACTIVE' ? (
                  <button onClick={() => act(s.id, 'pause')} disabled={busy === s.id} className="btn-ghost">
                    <Pause className="h-4 w-4" />
                    Mettre en pause
                  </button>
                ) : s.status === 'PAUSED' ? (
                  <button onClick={() => act(s.id, 'resume')} disabled={busy === s.id} className="btn-soft">
                    <Play className="h-4 w-4" />
                    Reprendre
                  </button>
                ) : null}

                {s.status !== 'CANCELLED' && (
                  <button
                    onClick={() => {
                      if (window.confirm('Annuler definitivement ce parrainage ?')) act(s.id, 'cancel');
                    }}
                    disabled={busy === s.id}
                    className="btn-ghost text-accent-coral"
                  >
                    <X className="h-4 w-4" />
                    Annuler
                  </button>
                )}

                {s.status === 'ACTIVE' && (
                  <button onClick={() => openChannel(s.child.id)} className="btn-soft ml-auto">
                    <MessageCircle className="h-4 w-4" />
                    Écrire à l’ambassadeur
                  </button>
                )}
              </div>

              {s.donations?.length > 0 && (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <p className="mb-2 text-xs font-medium text-ink-500">Dernieres echeances</p>
                  <div className="flex flex-wrap gap-2">
                    {s.donations.map((d: any) => (
                      <span key={d.id} className="chip bg-ink-100 text-ink-600">
                        {date(d.createdAt)} - {money(d.amount, d.currency)} - {d.status}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
