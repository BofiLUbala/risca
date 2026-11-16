'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Archive } from 'lucide-react';
import { fetcher, mediaUrl } from '@/lib/api';
import { Empty } from '@/components/ui/Empty';
import { PageLoading } from '@/components/ui/Loading';
import { ROLE_LABEL, type Role } from '@/lib/roles';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <section className="card card-pad">
      <h2 className="text-sm font-semibold text-ink-900">
        {title}
        {count != null ? <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">{count}</span> : null}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Rows = ({ rows, render }: { rows: any[]; render: (r: any) => React.ReactNode }) =>
  rows.length ? (
    <ul className="divide-y divide-ink-100 text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
          {render(r)}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-ink-500">{t("Rien à afficher.")}</p>
  );

/** Copie en lecture seule de l'ancien espace, faite après l'accord du chef régional ou national. */
export default function AncienEspacePage() {
  const { data: mine, isLoading } = useSWR<any>('/transitions/mine', fetcher);
  const { data: archive, isLoading: loadingArchive } = useSWR<any>(mine?.clonedAt ? `/transitions/${mine.id}/archive` : null, fetcher);

  if (isLoading || loadingArchive) return <PageLoading />;
  const s = archive?.snapshot;

  return (
    <div className="space-y-5">
      <Link href="/tableau-de-bord" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("Retour au tableau de bord")}
      </Link>

      {!s ? (
        <Empty icon={<Archive className="h-6 w-6" />} title={t("Pas encore de données clonées")} description={t("Clonez vos données depuis votre tableau de bord, une fois l’accord de votre responsable donné.")} />
      ) : (
        <>
          <div>
            <h1 className="page-title">{t("Mon ancien espace")}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {t("Copie en lecture seule de votre espace")}{' '}{ROLE_LABEL[s.fromRole as Role]}{t(", faite le")}{' '}{dateTime(s.takenAt)}.
            </p>
          </div>

          <Section title={t("Mes tâches en cours")}>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-500">{t("Demandes en attente")}</dt>
                <dd className="text-lg font-semibold text-ink-900">{s.tasks.open.requestsPending}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">{t("Dossiers d’enfants en cours")}</dt>
                <dd className="text-lg font-semibold text-ink-900">{s.tasks.open.childRecordsInProgress}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">{t("Orphelinats proposés en attente")}</dt>
                <dd className="text-lg font-semibold text-ink-900">{s.tasks.open.orphanageProposalsPending}</dd>
              </div>
            </dl>
          </Section>

          <Section title={t("Responsabilités : enfants suivis")} count={s.responsibilities.childAssignments.length}>
            <Rows rows={s.responsibilities.childAssignments} render={(r) => (<><span>{r.childPublicId} · {r.orphanage ?? '—'}</span><span className="text-xs text-ink-500">{t("depuis")}{' '}{dateTime(r.since)}</span></>)} />
          </Section>

          <Section title={t("Responsabilités : orphelinats")} count={s.responsibilities.orphanages.length}>
            <Rows rows={s.responsibilities.orphanages} render={(r) => (<><span>{r.name}</span><span className="text-xs text-ink-500">{t("depuis")}{' '}{dateTime(r.since)}</span></>)} />
          </Section>

          <Section title={t("Mes demandes")} count={s.tasks.requests.length}>
            <Rows rows={s.tasks.requests} render={(r) => (<><span>{r.label}</span><span className="text-xs text-ink-500">{r.status} · {dateTime(r.at)}</span></>)} />
          </Section>

          <Section title={t("Photos")} count={s.photos.length}>
            {s.photos.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {s.photos.map((p: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={mediaUrl(p) ?? p} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">{t("Aucune photo.")}</p>
            )}
          </Section>

          <Section title={t("Publications")} count={s.posts.length}>
            <Rows rows={s.posts} render={(r) => (<><span className="min-w-0 flex-1 truncate">{r.content}</span><span className="text-xs text-ink-500">{dateTime(r.at)}</span></>)} />
          </Section>

          <Section title={t("Historique : dossiers d’enfants saisis")} count={s.history.childrenRecorded.length}>
            <Rows rows={s.history.childrenRecorded} render={(r) => (<><span>{r.publicId} · {r.orphanage ?? '—'}</span><span className="text-xs text-ink-500">{r.status} · {dateTime(r.at)}</span></>)} />
          </Section>

          <Section title={t("Historique : orphelinats proposés")} count={s.history.orphanagesProposed.length}>
            <Rows rows={s.history.orphanagesProposed} render={(r) => (<><span>{r.name}</span><span className="text-xs text-ink-500">{r.status} · {dateTime(r.at)}</span></>)} />
          </Section>

          <Section title={t("Historique : visites")} count={s.history.visits.length}>
            <Rows rows={s.history.visits} render={(r) => (<><span>{r.childPublicId ?? t("Visite")}</span><span className="text-xs text-ink-500">{dateTime(r.at)}</span></>)} />
          </Section>

          <Section title={t("Historique : événements des dossiers")} count={s.history.childTimeline.length}>
            <Rows rows={s.history.childTimeline} render={(r) => (<><span>{r.title} · {r.childPublicId ?? '—'}</span><span className="text-xs text-ink-500">{dateTime(r.at)}</span></>)} />
          </Section>

          <Section title={t("Historique : actions récentes")} count={s.history.recentActions.length}>
            <Rows rows={s.history.recentActions} render={(r) => (<><span>{r.action}</span><span className="text-xs text-ink-500">{r.entity} · {dateTime(r.at)}</span></>)} />
          </Section>
        </>
      )}
    </div>
  );
}
