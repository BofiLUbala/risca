'use client';

import { uploadFile } from '@/lib/api';
import { useState } from 'react';

/** Rend un champ du modele de dossier du pays (section 5.2). */
export function DynamicField({
  field,
  value,
  onChange,
}: {
  field: any;
  value: any;
  onChange: (v: any) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const id = `f_${field.key}`;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file);
      onChange(up.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="label">
        {field.labelFr}
        {field.required && <span className="ml-1 text-accent-coral">*</span>}
      </label>

      {field.type === 'LONGTEXT' ? (
        <textarea
          id={id}
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="input resize-y"
        />
      ) : field.type === 'SELECT' ? (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input">
          <option value="">Choisir</option>
          {field.options.map((o: string) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.type === 'MULTISELECT' ? (
        <div className="flex flex-wrap gap-2">
          {field.options.map((o: string) => {
            const list: string[] = Array.isArray(value) ? value : [];
            const on = list.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
                className={
                  on
                    ? 'rounded-full bg-risac-600 px-3 py-1.5 text-xs font-medium text-white'
                    : 'rounded-full bg-ink-100 px-3 py-1.5 text-xs font-medium text-ink-600'
                }
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : field.type === 'BOOLEAN' ? (
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-risac-600"
          />
          Oui
        </label>
      ) : field.type === 'FILE' || field.type === 'PHOTO' ? (
        <div className="flex items-center gap-3">
          <label className="btn-outline cursor-pointer">
            {uploading ? 'Téléversement...' : value ? 'Remplacer' : 'Choisir un fichier'}
            <input
              id={id}
              type="file"
              accept={field.type === 'PHOTO' ? 'image/*' : undefined}
              onChange={onFile}
              className="sr-only"
            />
          </label>
          {value && <span className="truncate text-xs text-emerald-600">Document joint</span>}
        </div>
      ) : (
        <input
          id={id}
          type={field.type === 'DATE' ? 'date' : field.type === 'NUMBER' ? 'number' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="input"
        />
      )}

      {field.helpText && <p className="mt-1.5 text-xs text-ink-400">{field.helpText}</p>}
    </div>
  );
}
