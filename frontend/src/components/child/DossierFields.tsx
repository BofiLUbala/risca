'use client';

import { Field } from './Tabs';
import { mediaUrl } from '@/lib/api';

/** Rend les champs dynamiques definis par le modele de dossier du pays. */
export function DossierFields({ template, data }: { template: any; data: Record<string, any> }) {
  if (!template?.sections?.length) {
    return <p className="text-sm text-ink-400">Aucun modele de dossier defini pour ce pays.</p>;
  }

  return (
    <div className="space-y-5">
      {template.sections.map((section: any) => (
        <section key={section.id} className="card card-pad">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="card-title">{section.labelFr}</h2>
            <span className="chip bg-ink-100 text-ink-500">{section.visibility}</span>
          </div>
          <dl>
            {section.fields.map((field: any) => {
              const raw = data?.[field.key];
              let value: React.ReactNode = raw;

              if (raw == null || raw === '') value = undefined;
              else if (Array.isArray(raw)) value = raw.join(', ');
              else if (field.type === 'BOOLEAN') value = raw ? 'Oui' : 'Non';
              else if (field.type === 'FILE' || field.type === 'PHOTO') {
                value = (
                  <a
                    href={mediaUrl(String(raw)) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-risac-600 hover:text-risac-700"
                  >
                    Ouvrir le document
                  </a>
                );
              }

              return (
                <Field
                  key={field.id}
                  label={`${field.labelFr}${field.required ? ' *' : ''}`}
                  value={value}
                />
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
