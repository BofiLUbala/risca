'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { FileCog, Plus, Trash2 } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { SkeletonList } from '@/components/ui/Loading';

const TYPES = ['TEXT', 'LONGTEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'FILE', 'PHOTO'];

export default function TemplatesPage() {
  const { data: countries } = useSWR<any[]>('/geo/countries', fetcher);
  const [countryId, setCountryId] = useState('');
  const { data: template, isLoading, mutate } = useSWR<any>(
    countryId ? `/templates/country/${countryId}` : null,
    fetcher,
  );
  const [error, setError] = useState<string | null>(null);

  async function addField(sectionId: string) {
    const labelFr = window.prompt('Libelle du champ (francais) ?');
    if (!labelFr) return;
    const type = window.prompt(`Type ? (${TYPES.join(', ')})`, 'TEXT');
    const required = window.confirm('Ce champ est-il obligatoire ?');
    const key = labelFr
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    setError(null);
    try {
      await api.post(`/templates/sections/${sectionId}/fields`, {
        key,
        labelFr,
        labelEn: labelFr,
        type: type ?? 'TEXT',
        required,
      });
      mutate();
    } catch (e: any) {
      setError(e?.message ?? 'Ajout impossible');
    }
  }

  async function removeField(fieldId: string) {
    if (!window.confirm('Supprimer ce champ du modele ?')) return;
    await api.del(`/templates/fields/${fieldId}`);
    mutate();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Modèles de dossier</h1>
        <p className="mt-1 text-sm text-ink-500">
          Les champs et documents requis varient selon le pays. Ajouter un pays ou un champ ne demande
          aucun changement de code.
        </p>
      </div>

      <div className="card card-pad">
        <label htmlFor="country" className="label">
          Pays
        </label>
        <select
          id="country"
          value={countryId}
          onChange={(e) => setCountryId(e.target.value)}
          className="input sm:w-80"
        >
          <option value="">Choisir un pays</option>
          {countries?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameFr}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {!countryId ? (
        <div className="card card-pad flex items-center gap-3 text-sm text-ink-500">
          <FileCog className="h-5 w-5 text-ink-400" />
          Choisissez un pays pour afficher son modele de dossier.
        </div>
      ) : isLoading ? (
        <SkeletonList rows={4} />
      ) : !template ? (
        <div className="card card-pad text-sm text-ink-500">Aucun modele pour ce pays.</div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-500">
            {template.name} &middot; version {template.version} &middot; {template.sections.length}{' '}
            sections
          </p>

          {template.sections.map((s: any) => (
            <section key={s.id} className="card card-pad">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="card-title">{s.labelFr}</h2>
                  <p className="text-xs text-ink-400">
                    cle : {s.key} &middot; visibilite : {s.visibility}
                  </p>
                </div>
                <button onClick={() => addField(s.id)} className="btn-soft h-9">
                  <Plus className="h-4 w-4" />
                  Champ
                </button>
              </div>

              <div className="divide-y divide-ink-100">
                {s.fields.map((f: any) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink-800">
                        {f.labelFr}
                        {f.required && <span className="ml-1 text-accent-coral">*</span>}
                      </span>
                      <span className="block text-xs text-ink-400">
                        {f.key} &middot; {f.type}
                        {f.options?.length ? ` (${f.options.join(', ')})` : ''}
                      </span>
                    </span>
                    <span className="chip bg-ink-100 text-ink-500">{f.visibility}</span>
                    <button
                      onClick={() => removeField(f.id)}
                      className="btn-ghost h-8 w-8 p-0 text-ink-400 hover:text-accent-coral"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
