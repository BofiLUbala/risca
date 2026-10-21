'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Save } from 'lucide-react';
import { api, fetcher, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageLoading, Spinner } from '@/components/ui/Loading';

/** Mises a jour de l enfant (section 6.2) : chaque type a sa regle de validation. */
const KINDS = [
  { key: 'HEALTH', label: 'Santé', hint: 'Validée par l’ambassadeur', roles: ['ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'AMBASSADOR', 'SUPER_ADMIN'] },
  { key: 'SCHOOLING', label: 'Scolarité / bulletin', hint: 'Validée par l’ambassadeur', roles: ['ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'AMBASSADOR', 'SUPER_ADMIN'] },
  { key: 'PSYCHOTRAUMA', label: 'Psychotrauma', hint: 'Confidentiel, aucune validation', roles: ['ORPHANAGE_STAFF', 'SUPER_ADMIN'] },
  { key: 'FONAREV', label: 'Démarche FONAREV', hint: 'Saisie par l’ambassadeur', roles: ['AMBASSADOR', 'SUPER_ADMIN'] },
  { key: 'VISIT', label: 'Rapport de visite', hint: 'Au moins une fois par trimestre', roles: ['AMBASSADOR', 'SUPER_ADMIN'] },
  { key: 'INCIDENT', label: 'Incident', hint: 'Consigné dans l’historique', roles: ['ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'AMBASSADOR', 'REGIONAL_MANAGER', 'SUPER_ADMIN'] },
];

export default function ChildUpdatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data: child } = useSWR<any>(`/children/${id}`, fetcher);

  const available = KINDS.filter((k) => k.roles.includes(user?.role ?? ''));
  const [kind, setKind] = useState(available[0]?.key ?? 'HEALTH');
  const [form, setForm] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!child) return <PageLoading />;

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const up = await uploadFile(file);
    setPhotos((p) => [...p, up.url]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (kind === 'HEALTH') {
        await api.post(`/children/${id}/health`, form);
      } else if (kind === 'SCHOOLING') {
        await api.post(`/children/${id}/school`, {
          ...form,
          average: form.average ? Number(form.average) : undefined,
          fees: form.fees ? Number(form.fees) : undefined,
        });
      } else if (kind === 'PSYCHOTRAUMA') {
        await api.post(`/children/${id}/psycho`, form);
      } else if (kind === 'VISIT') {
        await api.post(`/children/${id}/visit`, { ...form, photos });
      } else {
        await api.post(`/children/${id}/timeline`, {
          type: kind,
          title: form.title ?? KINDS.find((k) => k.key === kind)?.label,
          description: form.description,
          attachments: photos,
        });
      }
      router.push(`/enfants/${id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Enregistrement impossible');
      setBusy(false);
    }
  }

  const active = KINDS.find((k) => k.key === kind);

  return (
    <div className="max-w-2xl space-y-5">
      <Link
        href={`/enfants/${id}`}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au dossier
      </Link>

      <div>
        <h1 className="page-title">
          Mise a jour de {child.firstName}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Chaque mise à jour crée une entrée dans l’historique, qui ne peut pas être effacée.
        </p>
      </div>

      <form onSubmit={submit} className="card card-pad space-y-4">
        <div>
          <label className="label">Type de mise à jour</label>
          <div className="flex flex-wrap gap-2">
            {available.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => {
                  setKind(k.key);
                  setForm({});
                }}
                className={
                  kind === k.key
                    ? 'inline-flex min-h-[40px] items-center rounded-full bg-risac-700 px-3.5 py-1.5 text-xs font-medium text-white'
                    : 'inline-flex min-h-[40px] items-center rounded-full bg-ink-100 px-3.5 py-1.5 text-xs font-medium text-ink-600'
                }
              >
                {k.label}
              </button>
            ))}
          </div>
          {active ? <p className="mt-2 text-xs text-ink-400">{active.hint}</p> : null}
        </div>

        <UpdateFields kind={kind} form={form} set={set} />

        {(kind === 'VISIT' || kind === 'INCIDENT') && (
          <div>
            <label className="label">Photos</label>
            <label className="btn-outline cursor-pointer">
              Ajouter une photo
              <input type="file" accept="image/*" onChange={addPhoto} className="sr-only" />
            </label>
            {photos.length > 0 ? (
              <p className="mt-2 text-xs text-emerald-600">{photos.length} photo(s) jointe(s)</p>
            ) : null}
          </div>
        )}

        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          <Link href={`/enfants/${id}`} className="btn-ghost">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}

function UpdateFields({
  kind,
  form,
  set,
}: {
  kind: string;
  form: Record<string, any>;
  set: (k: string, v: any) => void;
}) {
  const text = (name: string, label: string, type = 'text') => (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        type={type}
        value={form[name] ?? ''}
        onChange={(e) => set(name, e.target.value)}
        className="input"
      />
    </div>
  );

  const area = (name: string, label: string) => (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <textarea
        id={name}
        rows={3}
        value={form[name] ?? ''}
        onChange={(e) => set(name, e.target.value)}
        className="input resize-y"
      />
    </div>
  );

  if (kind === 'HEALTH') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {text('bloodType', 'Groupe sanguin')}
        {text('vaccines', 'Vaccins')}
        {text('illnesses', 'Maladies')}
        {text('disability', 'Handicap')}
        <div className="sm:col-span-2">{area('treatments', 'Traitements')}</div>
        <div className="sm:col-span-2">{area('consultation', 'Consultation')}</div>
      </div>
    );
  }

  if (kind === 'SCHOOLING') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {text('school', 'Etablissement')}
        {text('grade', 'Classe')}
        {text('term', 'Trimestre')}
        {text('year', 'Annee scolaire')}
        {text('average', 'Moyenne', 'number')}
        {text('fees', 'Frais scolaires', 'number')}
        <div className="sm:col-span-2">{area('results', 'Resultats')}</div>
        <div className="sm:col-span-2">
          {area('publicSummary', 'Résumé public (visible par le parrain)')}
        </div>
      </div>
    );
  }

  if (kind === 'PSYCHOTRAUMA') {
    return (
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={!!form.isInitialAssessment}
            onChange={(e) => set('isInitialAssessment', e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-risac-600"
          />
          Evaluation initiale
        </label>
        {area('evaluation', 'Evaluation')}
        {area('notes', 'Notes du psychologue')}
        {area('evolution', 'Evolution')}
        <p className="rounded-xl bg-violet-50 px-3.5 py-2.5 text-xs text-violet-800">
          Volet très confidentiel : visible uniquement par le psychologue, l’ambassadeur assigné et
          l’Auditeur Éthique.
        </p>
      </div>
    );
  }

  if (kind === 'VISIT') {
    return (
      <div className="space-y-4">
        {area('note', 'Compte rendu de la visite')}
        {text('rating', 'Appreciation sur 5', 'number')}
        <div className="grid gap-4 sm:grid-cols-2">
          {text('latitude', 'Latitude GPS', 'number')}
          {text('longitude', 'Longitude GPS', 'number')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {text('title', 'Titre')}
      {area('description', 'Description')}
    </div>
  );
}
