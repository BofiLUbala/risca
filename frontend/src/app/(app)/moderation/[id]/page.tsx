'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Loading';
import { Field } from '@/components/child/Tabs';
import { dateTime } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: reports, isLoading, mutate } = useSWR<any[]>('/moderation/reports', fetcher);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const [postNotice, setPostNotice] = useState<{ ok: boolean; text: string } | null>(null);

  if (isLoading) return <PageLoading />;
  const r = reports?.find((x) => x.id === id);

  if (!r) {
    return (
      <div className="card card-pad">
        <p className="text-sm text-ink-500">Signalement introuvable ou deja traite.</p>
        <Link href="/moderation" className="btn-soft mt-4">
          Retour à la modération
        </Link>
      </div>
    );
  }

  async function resolve(status: 'ACTIONED' | 'DISMISSED') {
    const resolution = window.prompt(
      status === 'ACTIONED' ? 'Mesure prise ?' : 'Motif du classement sans suite ?',
    );
    if (!resolution) return;
    setBusy(true);
    await api.post(`/moderation/reports/${id}/resolve`, { status, resolution });
    mutate();
    setBusy(false);
  }

  const canModeratePost = r.targetType === 'POST' && ['MODERATOR', 'SUPER_ADMIN'].includes(user?.role ?? '');

  /** Masque ou retablit la publication signalee (le signalement seul ne la touchait pas). */
  async function moderatePost(action: 'hide' | 'restore') {
    let body: { reason?: string } = {};
    if (action === 'hide') {
      const reason = window.prompt('Motif du masquage (transmis à l’auteur) ?');
      if (!reason?.trim()) return;
      body = { reason: reason.trim() };
    } else if (!window.confirm('Rétablir cette publication dans le fil ?')) {
      return;
    }
    setBusy(true);
    setPostNotice(null);
    try {
      await api.post(`/posts/${r.targetId}/${action}`, body);
      setPostNotice({ ok: true, text: action === 'hide' ? 'Publication masquée.' : 'Publication rétablie.' });
    } catch (e: any) {
      setPostNotice({ ok: false, text: e?.message ?? 'Action impossible.' });
    }
    setBusy(false);
  }

  const targetHref =
    r.targetType === 'POST'
      ? `/communication/${r.targetId}`
      : r.targetType === 'CHILD'
        ? `/enfants/${r.targetId}`
        : r.targetType === 'PROJECT'
          ? `/projets/${r.targetId}`
          : r.targetType === 'ORPHANAGE'
            ? `/orphelinats/${r.targetId}`
            : null;

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href="/moderation"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la modération
      </Link>

      <header className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">{r.reason}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {r.targetType} - {dateTime(r.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {r.severity === 'SERIOUS' ? (
              <span className="chip bg-rose-100 text-rose-700">Signalement grave</span>
            ) : null}
            <Badge status={r.status} />
          </div>
        </div>

        {targetHref ? (
          <Link href={targetHref} className="btn-soft mt-4">
            Ouvrir le contenu signale
          </Link>
        ) : null}
      </header>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">Détail</h2>
        <dl>
          <Field
            label="Signalé par"
            value={`${r.reporter.firstName} ${r.reporter.lastName} (${ROLE_LABEL[r.reporter.role as keyof typeof ROLE_LABEL]})`}
          />
          <Field label="Détails" value={r.details} />
          <Field
            label="Traite par"
            value={r.handler ? `${r.handler.firstName} ${r.handler.lastName}` : null}
          />
          <Field label="Resolution" value={r.resolution} />
        </dl>
      </section>

      {canModeratePost ? (
        <section className="card card-pad">
          <h2 className="mb-1 card-title">Publication signalée</h2>
          <p className="mb-3 text-sm text-ink-500">
            Clore le signalement ne retire pas la publication du fil : masquez-la ici si elle doit
            disparaître, ou rétablissez-la si le masquage était injustifié.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => moderatePost('hide')} disabled={busy} className="btn-danger">
              Masquer la publication
            </button>
            <button onClick={() => moderatePost('restore')} disabled={busy} className="btn-outline">
              Rétablir la publication
            </button>
          </div>
          {postNotice ? (
            <p
              role="status"
              className={postNotice.ok ? 'mt-3 text-sm text-emerald-700' : 'mt-3 text-sm text-rose-700'}
            >
              {postNotice.text}
            </p>
          ) : null}
        </section>
      ) : null}

      {r.status === 'OPEN' ? (
        <section className="card card-pad">
          <h2 className="mb-3 card-title">Décision</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => resolve('ACTIONED')} disabled={busy} className="btn-primary">
              Traiter
            </button>
            <button onClick={() => resolve('DISMISSED')} disabled={busy} className="btn-ghost">
              Classer sans suite
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
