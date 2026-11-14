'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Save } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Loading';
import { CountrySelect, ProvinceSelect } from '@/components/geo/GeoSelects';

/** Chef regional ou Agent propose, puis le Super Admin valide (section 4). */
export default function NewOrphanagePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: countries } = useSWR<any[]>('/geo/countries', fetcher);
  // Hors Super Admin, la structure est enregistrée dans son propre pays (responsable national) ou sa propre région
  // (chef régional, agent de terrain) : ces choix sont figés, l'API refuse le reste.
  const lockCountry = !!user && user.role !== 'SUPER_ADMIN' && !!user.country;
  const lockProvince = !!user && (user.role === 'REGIONAL_MANAGER' || user.role === 'FIELD_AGENT') && !!user.province;

  const [form, setForm] = useState({
    name: '',
    countryId: '',
    provinceId: '',
    city: '',
    commune: '',
    address: '',
    description: '',
    legalStatus: '',
    licenseNumber: '',
    totalPlaces: '',
    occupiedPlaces: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: provinces } = useSWR<any[]>(
    form.countryId ? `/geo/countries/${form.countryId}/provinces` : null,
    fetcher,
  );

  // Pays et région de l'auteur, préremplis dès que le profil est chargé.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      countryId: lockCountry ? (user.country?.id ?? f.countryId) : f.countryId,
      provinceId: lockProvince ? (user.province?.id ?? f.provinceId) : f.provinceId,
    }));
  }, [user?.id, lockCountry, lockProvince]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<any>('/orphanages', {
        ...form,
        totalPlaces: form.totalPlaces ? Number(form.totalPlaces) : undefined,
        occupiedPlaces: form.occupiedPlaces ? Number(form.occupiedPlaces) : undefined,
      });
      router.push(`/orphelinats/${r.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Proposition impossible');
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href="/orphelinats"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux orphelinats
      </Link>

      <div>
        <h1 className="page-title">Proposer un orphelinat</h1>
        <p className="mt-1 text-sm text-ink-500">
          La structure est creee en proposition, puis verifiee par le chef regional et validée par le
          Super Admin.
        </p>
      </div>

      <form onSubmit={submit} className="card card-pad space-y-4">
        <div>
          <label htmlFor="name" className="label">
            Nom de la structure <span className="text-accent-coral">*</span>
          </label>
          <input
            id="name"
            required
            minLength={3}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ctry" className="label">
              Pays <span className="text-accent-coral">*</span>
            </label>
            {lockCountry ? (
              <p id="ctry" className="input bg-ink-50 text-ink-700">
                {user?.country?.nameFr}
              </p>
            ) : (
              <CountrySelect
                id="ctry"
                value={form.countryId}
                onChange={(id) => setForm({ ...form, countryId: id, provinceId: '' })}
              />
            )}
          </div>
          <div>
            <label htmlFor="prov" className="label">
              Province <span className="text-accent-coral">*</span>
            </label>
            {lockProvince ? (
              <p id="prov" className="input bg-ink-50 text-ink-700">
                {user?.province?.nameFr}
              </p>
            ) : (
              <ProvinceSelect
                id="prov"
                required
                countryId={form.countryId}
                value={form.provinceId}
                onChange={(id) => setForm({ ...form, provinceId: id })}
              />
            )}
          </div>
          <div>
            <label htmlFor="city" className="label">
              Ville
            </label>
            <input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="commune" className="label">
              Commune
            </label>
            <input
              id="commune"
              value={form.commune}
              onChange={(e) => setForm({ ...form, commune: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="legal" className="label">
              Statut juridique
            </label>
            <input
              id="legal"
              value={form.legalStatus}
              onChange={(e) => setForm({ ...form, legalStatus: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="lic" className="label">
              Numéro d’agrement
            </label>
            <input
              id="lic"
              value={form.licenseNumber}
              onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="tp" className="label">
              Places totales
            </label>
            <input
              id="tp"
              type="number"
              min={0}
              value={form.totalPlaces}
              onChange={(e) => setForm({ ...form, totalPlaces: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="op" className="label">
              Places occupées
            </label>
            <input
              id="op"
              type="number"
              min={0}
              value={form.occupiedPlaces}
              onChange={(e) => setForm({ ...form, occupiedPlaces: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="desc" className="label">
            Description
          </label>
          <textarea
            id="desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input resize-y"
          />
        </div>

        <p className="rounded-xl bg-risac-50 px-3.5 py-2.5 text-xs text-risac-800">
          En zone à risque, la position exacte sera automatiquement masquée au public.
        </p>

        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Proposer la structure
          </button>
          <Link href="/orphelinats" className="btn-ghost">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
