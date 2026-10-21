'use client';

import { use, useState } from 'react';
import { SafeImage } from '@/components/ui/SafeImage';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft } from 'lucide-react';
import { fetcher, mediaUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Loading';
import { DonatePanel } from '@/components/donate/DonatePanel';
import { date, money, num, percent } from '@/lib/format';

export default function PublicProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: p, isLoading } = useSWR<any>(`/projects/public/${id}`, fetcher);
  const [open, setOpen] = useState(false);

  if (isLoading || !p) return <PageLoading />;
  const photo = mediaUrl(p.photos?.[0] ?? p.child?.publicPhotoUrl);
  const pct = percent(p.collectedAmount, p.targetAmount);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/projets-ouverts"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Tous les projets
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SafeImage src={photo} className="aspect-[16/9] w-full rounded-2xl object-cover" />

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{p.title}</h1>
              <Badge status={p.status} />
            </div>
            <p className="mt-2 text-sm text-ink-500">
              {p.child ? p.child.firstName : (p.orphanage?.name ?? '')}
              {p.orphanage?.province ? ` - ${p.orphanage.province.nameFr}` : ''}
              {p.category ? ` - ${p.category}` : ''}
            </p>
          </div>

          <section className="card card-pad">
            <h2 className="card-title">Le projet</h2>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink-700">{p.description}</p>
          </section>

          {p.milestones?.length ? (
            <section className="card card-pad">
              <h2 className="card-title">Les étapes</h2>
              <ol className="mt-3 space-y-3">
                {p.milestones.map((m: any) => (
                  <li key={m.id} className="border-l-2 border-risac-200 pl-4">
                    <p className="text-sm font-medium text-ink-800">{m.title}</p>
                    {m.description ? <p className="text-sm text-ink-600">{m.description}</p> : null}
                    <p className="mt-0.5 text-xs text-ink-400">
                      {m.completedAt ? date(m.completedAt) : 'en cours'}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card card-pad">
            <p className="text-2xl font-semibold tracking-tight text-ink-900">
              {money(p.collectedAmount, p.currency)}
            </p>
            <p className="text-sm text-ink-500">sur {money(p.targetAmount, p.currency)}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-risac-400 to-risac-600"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-400">
              {pct} % finance - {num(p.donorCount)} bailleur(s)
              {p.endDate ? ` - collecte jusqu au ${date(p.endDate)}` : ''}
            </p>

            {pct >= 100 ? (
              <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Objectif atteint. Ce projet ne recoit plus de dons.
              </p>
            ) : !user ? (
              <div className="mt-5 space-y-2">
                <Link href="/inscription" className="btn-primary w-full py-3">
                  Créer un compte bailleur
                </Link>
                <Link href="/connexion" className="btn-outline w-full py-3">
                  Se connecter
                </Link>
              </div>
            ) : !open ? (
              <button onClick={() => setOpen(true)} className="btn-primary mt-5 w-full py-3">
                Contribuer a ce projet
              </button>
            ) : (
              <DonatePanel mode="PROJECT_CONTRIBUTION" projectId={p.id} />
            )}

            <p className="mt-5 border-t border-ink-100 pt-4 text-xs leading-relaxed text-ink-400">
              Vous pouvez retirer votre contribution avant la fin de la collecte. Chaque dépense est
              justifiée par une facture ou une photo.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
