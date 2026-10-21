'use client';

import { Upload } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { mediaUrl } from '@/lib/api';
import { Field } from '@/components/child/Tabs';
import { date, money, num, percent } from '@/lib/format';

export function ProjectBody({
  project,
  onAct,
}: {
  project: any;
  onAct: (path: string, body?: any) => void;
}) {
  function addMilestone() {
    const title = window.prompt('Titre de l’étape ?');
    if (!title) return;
    const description = window.prompt('Description (facultatif)') ?? undefined;
    onAct('milestones', { title, description, completed: true });
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <h2 className="mb-3 card-title">Description</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {project.description}
          </p>

          {project.photos?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.photos.map((ph: string) => (
                <SafeImage key={ph} src={mediaUrl(ph)} className="h-24 w-24 rounded-xl object-cover" />
              ))}
            </div>
          ) : null}
        </section>

        <section className="card card-pad">
          <h2 className="mb-3 card-title">Collecte</h2>
          <p className="text-2xl font-semibold tracking-tight text-ink-900">
            {money(project.collectedAmount, project.currency)}
          </p>
          <p className="text-sm text-ink-500">sur {money(project.targetAmount, project.currency)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-risac-400 to-risac-600"
              style={{ width: `${percent(project.collectedAmount, project.targetAmount)}%` }}
            />
          </div>
          <dl className="mt-4">
            <Field label="Bailleurs inscrits" value={num(project.donorCount)} />
            <Field label="Solde disponible" value={money(project.balance?.balance ?? 0)} />
            <Field label="Début" value={date(project.startDate)} />
            <Field label="Fin" value={date(project.endDate)} />
          </dl>
        </section>
      </div>

      <section className="card card-pad">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="card-title">Étapes et preuves</h2>
          <button onClick={addMilestone} className="btn-soft h-9">
            <Upload className="h-4 w-4" />
            Ajouter une étape
          </button>
        </div>
        {!project.milestones?.length ? (
          <p className="text-sm text-ink-400">
            Aucune étape. Un rapport final avec preuves est requis pour terminer le projet.
          </p>
        ) : (
          <ol className="space-y-3">
            {project.milestones.map((m: any) => (
              <li key={m.id} className="border-l-2 border-risac-200 pl-4">
                <p className="text-sm font-medium text-ink-800">{m.title}</p>
                {m.description ? <p className="text-sm text-ink-600">{m.description}</p> : null}
                <p className="mt-0.5 text-xs text-ink-400">
                  {m.completedAt ? `terminee le ${date(m.completedAt)}` : 'en cours'}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
