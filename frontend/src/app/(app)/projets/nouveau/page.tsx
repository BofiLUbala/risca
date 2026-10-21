'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Save } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Loading';

// Memes roles que la creation cote API (projects.controller) : les autres n'ont rien a faire ici.
const CREATOR_ROLES = ['ORPHANAGE_DIRECTOR', 'AMBASSADOR', 'REGIONAL_MANAGER', 'SUPER_ADMIN'];

export default function NewProjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = !!user && CREATOR_ROLES.includes(user.role);
  useEffect(() => {
    if (user && !canCreate) router.replace('/projets');
  }, [user, canCreate, router]);

  // /dashboard/settings est reserve au Super Admin : les createurs lisent la version publique.
  const { data: settings } = useSWR<any>(canCreate ? '/dashboard/settings/public' : null, fetcher);
  const { data: childrenData } = useSWR<any>('/children?status=ACTIVE&take=100', fetcher);
  const { data: orphanages } = useSWR<any[]>('/orphanages', fetcher);

  const [form, setForm] = useState({
    title: '',
    description: '',
    childId: '',
    orphanageId: user?.orphanage?.id ?? '',
    targetAmount: '',
    currency: 'USD',
    category: '',
    endDate: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categories: string[] = settings?.project_categories ?? [];
  const threshold = Number(settings?.project_approval_threshold_usd ?? 1000);
  const aboveThreshold = Number(form.targetAmount || 0) > threshold;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<any>('/projects', {
        title: form.title,
        description: form.description,
        childId: form.childId || undefined,
        orphanageId: form.childId ? undefined : form.orphanageId || undefined,
        targetAmount: Number(form.targetAmount),
        currency: form.currency,
        category: form.category || undefined,
        endDate: form.endDate || undefined,
      });
      router.push(`/projets/${r.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Création impossible');
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/projets" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0">
        <ArrowLeft className="h-4 w-4" />
        Retour aux projets
      </Link>

      <div>
        <h1 className="page-title">Nouveau projet</h1>
        <p className="mt-1 text-sm text-ink-500">
          Un projet concernant un enfant doit etre valide par son ambassadeur avant publication.
        </p>
      </div>

      <form onSubmit={submit} className="card card-pad space-y-4">
        <div>
          <label htmlFor="title" className="label">
            Titre <span className="text-accent-coral">*</span>
          </label>
          <input
            id="title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input"
            placeholder="Opération chirurgicale urgente"
          />
        </div>

        <div>
          <label htmlFor="desc" className="label">
            Description <span className="text-accent-coral">*</span>
          </label>
          <textarea
            id="desc"
            required
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input resize-y"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="child" className="label">
              Enfant concerne
            </label>
            <select
              id="child"
              value={form.childId}
              onChange={(e) => setForm({ ...form, childId: e.target.value })}
              className="input"
            >
              <option value="">Projet d’orphelinat (sans enfant precis)</option>
              {childrenData?.items?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} ({c.publicId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="orph" className="label">
              Orphelinat
            </label>
            <select
              id="orph"
              value={form.orphanageId}
              onChange={(e) => setForm({ ...form, orphanageId: e.target.value })}
              disabled={!!form.childId}
              className="input"
            >
              <option value="">Choisir</option>
              {orphanages?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="amount" className="label">
              Montant vise <span className="text-accent-coral">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="amount"
                type="number"
                min={1}
                required
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className="input flex-1"
              />
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="input w-28"
                aria-label="Devise"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="CDF">CDF</option>
              </select>
            </div>
            {aboveThreshold ? (
              <p className="mt-1.5 text-xs text-amber-700">
                Au-dessus du seuil de {threshold} USD : une validation du chef regional sera ajoutee.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="cat" className="label">
              Catégorie
            </label>
            <select
              id="cat"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
            >
              <option value="">Choisir</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="end" className="label">
              Date de fin de collecte
            </label>
            <input
              id="end"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="input"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Créer le brouillon
          </button>
          <Link href="/projets" className="btn-ghost">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
