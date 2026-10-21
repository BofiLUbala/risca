'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Check, MessageSquareWarning, X } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { PageLoading, Spinner } from '@/components/ui/Loading';
import { dateTime } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';

export default function ValidationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data, isLoading, mutate } = useSWR<any>(`/approvals/${id}`, fetcher);

  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) return <PageLoading />;

  const current = data.steps.find((s: any) => s.order === data.currentStepOrder);
  const canDecide =
    data.status === 'PENDING' &&
    current &&
    (current.approverId ? current.approverId === user?.id : current.role === user?.role ||
      user?.role === 'SUPER_ADMIN');

  async function act(action: 'approve' | 'request-changes' | 'reject') {
    if (action !== 'approve' && comment.trim().length < 3) {
      setError('Un motif est obligatoire pour cette décision.');
      return;
    }
    setBusy(action);
    setError(null);
    try {
      await api.post(`/approvals/${id}/${action}`, { comment });
      setComment('');
      mutate();
    } catch (e: any) {
      setError(e?.message ?? 'Action impossible');
    }
    setBusy(null);
  }

  const entityHref =
    data.kind === 'CHILD_DOSSIER' || data.kind === 'CHILD_UPDATE'
      ? `/enfants/${data.entityId}`
      : data.kind === 'PROJECT'
        ? `/projets/${data.entityId}`
        : data.kind.startsWith('ORPHANAGE') || data.kind === 'LABEL_APPLICATION'
          ? `/orphelinats/${data.entityId}`
          : null;

  return (
    <div className="space-y-5">
      <Link href="/validations" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0">
        <ArrowLeft className="h-4 w-4" />
        Retour à la file
      </Link>

      <header className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">
              {data.entityLabel ?? data.kind}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              Demande le {dateTime(data.createdAt)}
              {data.escalated ? ' - remontee au niveau superieur' : ''}
            </p>
          </div>
          <Badge status={data.status} />
        </div>
        {entityHref && (
          <Link href={entityHref} className="btn-soft mt-4">
            Ouvrir le dossier concerne
          </Link>
        )}
      </header>

      <section className="card card-pad">
        <h2 className="mb-4 card-title">Circuit de validation</h2>
        <ol className="relative space-y-4 pl-8">
          <span aria-hidden="true" className="absolute left-[11px] top-2 h-[calc(100%-1rem)] w-px bg-ink-200" />
          {data.steps.map((s: any) => (
            <li key={s.id} className="relative">
              <span
                className={`absolute -left-8 grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ring-4 ring-white ${
                  s.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : s.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-700'
                      : s.status === 'CHANGES_REQUESTED'
                        ? 'bg-amber-100 text-amber-700'
                        : s.order === data.currentStepOrder
                          ? 'bg-risac-100 text-risac-700'
                          : 'bg-ink-100 text-ink-500'
                }`}
              >
                {s.order}
              </span>
              <div className="rounded-xl bg-ink-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink-800">
                    {ROLE_LABEL[s.role as keyof typeof ROLE_LABEL] ?? s.role}
                  </p>
                  <Badge status={s.status} />
                </div>
                {s.approver && (
                  <p className="mt-1 text-xs text-ink-500">
                    {s.approver.firstName} {s.approver.lastName}
                    {s.decidedAt ? ` - ${dateTime(s.decidedAt)}` : ''}
                  </p>
                )}
                {s.comment && <p className="mt-2 text-sm text-ink-600">{s.comment}</p>}
                {s.status === 'PENDING' && s.dueAt && (
                  <p className="mt-1 text-xs text-ink-400">Echeance : {dateTime(s.dueAt)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {canDecide && (
        <section className="card card-pad">
          <h2 className="mb-3 card-title">Votre décision</h2>
          {error && (
            <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}
          <label htmlFor="comment" className="label">
            Commentaire (obligatoire pour un refus ou une demande de correction)
          </label>
          <textarea
            id="comment"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="input resize-y"
            placeholder="Précisez votre décision..."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => act('approve')} disabled={!!busy} className="btn-primary">
              {busy === 'approve' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              Valider
            </button>
            <button onClick={() => act('request-changes')} disabled={!!busy} className="btn-outline">
              <MessageSquareWarning className="h-4 w-4" />
              Demander des corrections
            </button>
            <button onClick={() => act('reject')} disabled={!!busy} className="btn-danger">
              <X className="h-4 w-4" />
              Refuser
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
