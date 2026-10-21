'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Lock, Send } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Loading';
import { ProjectBody } from '@/components/project/ProjectBody';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: project, mutate } = useSWR<any>(`/projects/${id}`, fetcher);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!project) return <PageLoading />;

  const canSubmit =
    ['DRAFT', 'NEEDS_CORRECTION', 'REJECTED'].includes(project.status) &&
    ['ORPHANAGE_DIRECTOR', 'AMBASSADOR', 'REGIONAL_MANAGER', 'SUPER_ADMIN'].includes(user?.role ?? '');
  const canPublish =
    project.status === 'IN_VALIDATION' &&
    !project.pendingApproval &&
    ['AMBASSADOR', 'REGIONAL_MANAGER', 'SUPER_ADMIN'].includes(user?.role ?? '');
  const canFreeze = user?.role === 'ETHICS_AUDITOR' || user?.role === 'SUPER_ADMIN';
  // Avancement du chantier après publication : mise en exécution, clôture, annulation.
  const canSetStatus =
    ['PUBLISHED', 'FULLY_FUNDED', 'IN_EXECUTION', 'COMPLETED'].includes(project.status) &&
    ['ORPHANAGE_DIRECTOR', 'AMBASSADOR', 'REGIONAL_MANAGER', 'SUPER_ADMIN'].includes(user?.role ?? '');

  /**
   * Changement d’état du projet (PATCH /projects/:id/status). L’API exige un motif
   * pour une annulation et au moins une étape documentée pour terminer un projet.
   */
  async function setStatus(status: string) {
    const needsReason = status === 'CANCELLED';
    const reason = needsReason ? window.prompt('Motif de l’annulation ?') : undefined;
    if (needsReason && !reason) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.patch(`/projects/${id}/status`, { status, reason: reason ?? undefined });
      mutate();
      setMsg('État du projet mis à jour.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Changement d’état impossible');
    }
    setBusy(false);
  }

  async function act(path: string, body?: any) {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/projects/${id}/${path}`, body ?? {});
      mutate();
      setMsg('Action enregistrée.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Action impossible');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <Link href="/projets" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0">
        <ArrowLeft className="h-4 w-4" />
        Retour aux projets
      </Link>

      <header className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">{project.title}</h1>
              <Badge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {project.child
                ? `${project.child.firstName} (${project.child.publicId})`
                : (project.orphanage?.name ?? '')}
              {project.category ? ` - ${project.category}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canSubmit ? (
              <button onClick={() => act('submit')} disabled={busy} className="btn-primary">
                <Send className="h-4 w-4" />
                Soumettre a validation
              </button>
            ) : null}
            {canPublish ? (
              <button onClick={() => act('publish')} disabled={busy} className="btn-primary">
                Publier
              </button>
            ) : null}
            {canSetStatus ? (
              <select
                value=""
                disabled={busy}
                onChange={(e) => e.target.value && setStatus(e.target.value)}
                className="input w-auto min-w-[190px]"
                aria-label="Changer l’état du projet"
              >
                <option value="">Changer l&apos;état</option>
                <option value="IN_EXECUTION">Travaux en cours</option>
                <option value="COMPLETED">Projet terminé</option>
                <option value="CLOSED">Projet clôturé</option>
                <option value="CANCELLED">Annuler le projet</option>
              </select>
            ) : null}
            {canFreeze && project.status !== 'FROZEN' ? (
              <button
                onClick={() => {
                  const reason = window.prompt('Motif du gel ?');
                  if (reason) act('freeze', { reason });
                }}
                className="btn-ghost text-accent-coral"
              >
                <Lock className="h-4 w-4" />
                Geler
              </button>
            ) : null}
          </div>
        </div>

        {msg ? (
          <p role="status" className="mt-4 rounded-xl bg-risac-50 px-4 py-2.5 text-sm text-risac-800">
            {msg}
          </p>
        ) : null}

        {project.frozenReason ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            Projet gele : {project.frozenReason}
          </p>
        ) : null}

        {project.pendingApproval ? (
          <Link
            href={`/validations/${project.pendingApproval.id}`}
            className="mt-4 block rounded-xl border border-risac-200 bg-risac-50/70 px-4 py-3 text-sm text-risac-800 hover:bg-risac-50"
          >
            Circuit de validation en cours &middot; étape {project.pendingApproval.currentStepOrder}
          </Link>
        ) : null}
      </header>

      <ProjectBody project={project} onAct={act} />
    </div>
  );
}
