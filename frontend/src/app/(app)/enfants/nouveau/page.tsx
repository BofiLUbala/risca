'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AlertTriangle, ArrowLeft, Save } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DynamicField } from '@/components/child/DynamicField';
import { Spinner } from '@/components/ui/Loading';

/**
 * Bouton « + Nouvel enfant » (section 11) : le formulaire affiche
 * automatiquement les champs et documents requis dans le pays de l orphelinat.
 */
export default function NewChildPage() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: orphanages } = useSWR<any[]>('/orphanages', fetcher);
  const [orphanageId, setOrphanageId] = useState(user?.orphanage?.id ?? '');

  const orphanage = orphanages?.find((o) => o.id === orphanageId);
  const { data: template } = useSWR<any>(
    orphanage ? `/templates/country/${orphanage.country.id}` : null,
    fetcher,
  );

  const [base, setBase] = useState({
    firstName: '',
    lastName: '',
    sex: 'M',
    birthDate: '',
    publicStory: '',
    publicNeeds: '',
  });
  const [dossier, setDossier] = useState<Record<string, any>>({});
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function checkDuplicates() {
    if (base.firstName.length < 2 || base.lastName.length < 2) return;
    const r = await api.post<any[]>('/children/check-duplicates', {
      firstName: base.firstName,
      lastName: base.lastName,
      birthDate: base.birthDate || undefined,
      orphanageId,
    });
    setDuplicates(r);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<any>('/children', {
        ...base,
        birthDate: base.birthDate || undefined,
        orphanageId,
        dossierData: dossier,
      });
      router.push(`/enfants/${r.child.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Création impossible');
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/enfants" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0">
        <ArrowLeft className="h-4 w-4" />
        Retour aux enfants
      </Link>

      <div>
        <h1 className="page-title">Nouvel enfant</h1>
        <p className="mt-1 text-sm text-ink-500">
          Les champs et documents requis sont ceux du pays de la structure.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <section className="card card-pad space-y-4">
          <h2 className="card-title">Structure d’accueil</h2>
          <div>
            <label htmlFor="orph" className="label">
              Orphelinat
            </label>
            <select
              id="orph"
              required
              value={orphanageId}
              onChange={(e) => setOrphanageId(e.target.value)}
              className="input"
            >
              <option value="">Choisir une structure</option>
              {orphanages?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} - {o.country.nameFr}
                </option>
              ))}
            </select>
          </div>
        </section>

        <IdentitySection
          base={base}
          setBase={setBase}
          onBlurCheck={checkDuplicates}
          duplicates={duplicates}
        />

        {template ? (
          <section className="space-y-5">
            {template.sections.map((sec: any) => (
              <div key={sec.id} className="card card-pad space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="card-title">{sec.labelFr}</h2>
                  <span className="chip bg-ink-100 text-ink-500">{sec.visibility}</span>
                </div>
                {sec.fields.map((f: any) => (
                  <DynamicField
                    key={f.id}
                    field={f}
                    value={dossier[f.key]}
                    onChange={(v) => setDossier((d) => ({ ...d, [f.key]: v }))}
                  />
                ))}
              </div>
            ))}
          </section>
        ) : null}

        <section className="card card-pad space-y-4">
          <h2 className="card-title">Profil public</h2>
          <div>
            <label htmlFor="story" className="label">
              Histoire racontee avec soin
            </label>
            <textarea
              id="story"
              rows={3}
              value={base.publicStory}
              onChange={(e) => setBase({ ...base, publicStory: e.target.value })}
              className="input resize-y"
            />
          </div>
          <div>
            <label htmlFor="needs" className="label">
              Besoins
            </label>
            <input
              id="needs"
              value={base.publicNeeds}
              onChange={(e) => setBase({ ...base, publicNeeds: e.target.value })}
              className="input"
            />
          </div>
        </section>

        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" disabled={busy || !orphanageId} className="btn-primary">
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Enregistrer le brouillon
          </button>
          <Link href="/enfants" className="btn-ghost">
            Annuler
          </Link>
        </div>
        <p className="text-xs text-ink-400">
          Le dossier est cree en brouillon. Vous le soumettrez ensuite au circuit de validation.
        </p>
      </form>
    </div>
  );
}

function IdentitySection({
  base,
  setBase,
  onBlurCheck,
  duplicates,
}: {
  base: any;
  setBase: (v: any) => void;
  onBlurCheck: () => void;
  duplicates: any[];
}) {
  return (
    <section className="card card-pad space-y-4">
      <h2 className="card-title">Identité</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fn" className="label">
            Prenom <span className="text-accent-coral">*</span>
          </label>
          <input
            id="fn"
            required
            value={base.firstName}
            onChange={(e) => setBase({ ...base, firstName: e.target.value })}
            onBlur={onBlurCheck}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="ln" className="label">
            Nom (confidentiel) <span className="text-accent-coral">*</span>
          </label>
          <input
            id="ln"
            required
            value={base.lastName}
            onChange={(e) => setBase({ ...base, lastName: e.target.value })}
            onBlur={onBlurCheck}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="sex" className="label">
            Sexe <span className="text-accent-coral">*</span>
          </label>
          <select
            id="sex"
            value={base.sex}
            onChange={(e) => setBase({ ...base, sex: e.target.value })}
            className="input"
          >
            <option value="M">Masculin</option>
            <option value="F">Feminin</option>
          </select>
        </div>
        <div>
          <label htmlFor="bd" className="label">
            Date de naissance
          </label>
          <input
            id="bd"
            type="date"
            value={base.birthDate}
            onChange={(e) => setBase({ ...base, birthDate: e.target.value })}
            onBlur={onBlurCheck}
            className="input"
          />
        </div>
      </div>

      {duplicates.length > 0 ? (
        <div role="alert" className="rounded-xl bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Doublon possible detecte
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {duplicates.map((d) => (
              <li key={d.id}>
                {d.firstName} ({d.publicId}) - {d.orphanage.name} - correspondance {d.matchScore} %
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
