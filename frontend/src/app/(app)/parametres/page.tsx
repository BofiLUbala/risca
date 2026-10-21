'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Save } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { PageLoading, Spinner } from '@/components/ui/Loading';

export default function SettingsPage() {
  const { data, isLoading, mutate } = useSWR<any>('/dashboard/settings', fetcher);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  if (isLoading || !form) return <PageLoading />;

  async function save() {
    setBusy(true);
    setSaved(false);
    await api.patch('/dashboard/settings', {
      platform_fee_percent: Number(form.platform_fee_percent),
      project_approval_threshold_usd: Number(form.project_approval_threshold_usd),
      validation_escalation_hours: Number(form.validation_escalation_hours),
      regional_final_validation_for_child: form.regional_final_validation_for_child,
      multiple_sponsors_allowed: form.multiple_sponsors_allowed,
      maintenance_mode: form.maintenance_mode,
      project_categories: form.project_categories,
      supported_currencies: form.supported_currencies,
    });
    mutate();
    setBusy(false);
    setSaved(true);
  }

  function set(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Paramètres</h1>
        <p className="mt-1 text-sm text-ink-500">
          Seuils de validation, frais, devises et decisions de gouvernance.
        </p>
      </div>

      <section className="card card-pad space-y-4">
        <h2 className="card-title">Argent</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fee" className="label">
              Frais de fonctionnement (%)
            </label>
            <input
              id="fee"
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={form.platform_fee_percent}
              onChange={(e) => set('platform_fee_percent', e.target.value)}
              className="input"
            />
            <p className="mt-1.5 text-xs text-ink-400">Affiches au bailleur avant le paiement.</p>
          </div>
          <div>
            <label htmlFor="threshold" className="label">
              Seuil de validation du chef regional (USD)
            </label>
            <input
              id="threshold"
              type="number"
              min={0}
              step={100}
              value={form.project_approval_threshold_usd}
              onChange={(e) => set('project_approval_threshold_usd', e.target.value)}
              className="input"
            />
            <p className="mt-1.5 text-xs text-ink-400">
              Au-dessus de ce montant, un projet passe aussi par le chef regional.
            </p>
          </div>
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="card-title">Circuits de validation</h2>
        <div>
          <label htmlFor="esc" className="label">
            Délai avant remontee au niveau superieur (heures)
          </label>
          <input
            id="esc"
            type="number"
            min={1}
            value={form.validation_escalation_hours}
            onChange={(e) => set('validation_escalation_hours', e.target.value)}
            className="input sm:w-48"
          />
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!!form.regional_final_validation_for_child}
            onChange={(e) => set('regional_final_validation_for_child', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-ink-300 text-risac-600"
          />
          <span>
            <span className="block text-sm font-medium text-ink-800">
              Validation finale du chef regional pour chaque nouveau dossier enfant
            </span>
            <span className="block text-xs text-ink-500">
              Recommande pour limiter les doublons et la fraude.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!!form.multiple_sponsors_allowed}
            onChange={(e) => set('multiple_sponsors_allowed', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-ink-300 text-risac-600"
          />
          <span>
            <span className="block text-sm font-medium text-ink-800">
              Un enfant peut avoir plusieurs parrains
            </span>
            <span className="block text-xs text-ink-500">
              Decochez pour imposer un parrain exclusif par enfant.
            </span>
          </span>
        </label>
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="card-title">Exploitation</h2>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!!form.maintenance_mode}
            onChange={(e) => set('maintenance_mode', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-ink-300 text-risac-600"
          />
          <span>
            <span className="block text-sm font-medium text-ink-800">Mode maintenance</span>
            <span className="block text-xs text-ink-500">
              Affiche un message et bloque les ecritures pendant une intervention.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="cats" className="label">
            Catégories de projets (separees par une virgule)
          </label>
          <input
            id="cats"
            value={(form.project_categories ?? []).join(', ')}
            onChange={(e) => set('project_categories', e.target.value.split(',').map((s: string) => s.trim()))}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="curr" className="label">
            Devises acceptees
          </label>
          <input
            id="curr"
            value={(form.supported_currencies ?? []).join(', ')}
            onChange={(e) => set('supported_currencies', e.target.value.split(',').map((s: string) => s.trim()))}
            className="input"
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </button>
        {saved && <span className="text-sm text-emerald-600">Paramètres enregistrés.</span>}
      </div>
    </div>
  );
}
