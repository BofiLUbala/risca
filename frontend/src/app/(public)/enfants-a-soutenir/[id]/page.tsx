'use client';

import { use } from 'react';
import { SafeImage } from '@/components/ui/SafeImage';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, MapPin, Sparkles } from 'lucide-react';
import { fetcher, mediaUrl } from '@/lib/api';
import { PageLoading } from '@/components/ui/Loading';
import { date, money, percent } from '@/lib/format';
import { SupportSidebar } from '@/components/donate/SupportSidebar';

export default function PublicChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: child, isLoading } = useSWR<any>(`/children/public/${id}`, fetcher);

  if (isLoading || !child) return <PageLoading />;
  const photo = mediaUrl(child.publicPhotoUrl);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/enfants-a-soutenir"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Tous les enfants
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-risac-100 to-risac-300">
            <SafeImage
              src={photo}
              alt={child.firstName}
              className="aspect-[16/10] w-full object-cover"
              fallback={
                <div className="grid aspect-[16/10] place-items-center text-7xl font-semibold text-white/70">
                  {child.firstName[0]}
                </div>
              }
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-ink-950">{child.firstName}</h1>
              {child.age != null && <span className="text-lg text-ink-500">{child.age} ans</span>}
              {!child.hasSponsor && (
                <span className="chip bg-accent-amber/15 text-amber-700">
                  <Sparkles className="h-3 w-3" />
                  Sans parrain
                </span>
              )}
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-500">
              <MapPin className="h-4 w-4" />
              {child.region} &middot; {child.orphanage.country.nameFr}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {child.warOrphan && (
                <span className="chip bg-risac-50 text-risac-700">Orphelin de guerre</span>
              )}
              {child.displaced && <span className="chip bg-amber-50 text-amber-700">Deplace</span>}
            </div>
          </div>

          {child.publicStory && (
            <section className="card card-pad">
              <h2 className="card-title">Son histoire</h2>
              <p className="mt-2 leading-relaxed text-ink-700">{child.publicStory}</p>
            </section>
          )}

          {(child.lifeProject || child.desiredJob || child.talents) && (
            <section className="card card-pad">
              <h2 className="card-title">Son projet de vie</h2>
              {child.lifeProject && <p className="mt-2 text-ink-700">{child.lifeProject}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {child.desiredJob && (
                  <span className="chip bg-risac-50 text-risac-700">
                    Metier souhaite : {child.desiredJob}
                  </span>
                )}
                {child.talents && <span className="chip bg-ink-100 text-ink-600">{child.talents}</span>}
              </div>
            </section>
          )}

          {child.projects?.length > 0 && (
            <section className="card card-pad">
              <h2 className="card-title">Projets en cours</h2>
              <div className="mt-3 space-y-3">
                {child.projects.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/projets-ouverts/${p.id}`}
                    className="block rounded-xl bg-ink-50 p-4 hover:bg-risac-50"
                  >
                    <p className="text-sm font-medium text-ink-900">{p.title}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-risac-400 to-risac-600"
                        style={{ width: `${percent(p.collectedAmount, p.targetAmount)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-ink-500">
                      {money(p.collectedAmount, p.currency)} sur {money(p.targetAmount, p.currency)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {child.timeline?.length > 0 && (
            <section className="card card-pad">
              <h2 className="card-title">Ses nouvelles</h2>
              <ol className="mt-3 space-y-3">
                {child.timeline.map((e: any) => (
                  <li key={e.id} className="border-l-2 border-risac-200 pl-4">
                    <p className="text-sm font-medium text-ink-800">{e.title}</p>
                    {e.description && <p className="text-sm text-ink-600">{e.description}</p>}
                    <p className="mt-0.5 text-xs text-ink-400">{date(e.occurredAt)}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <SupportSidebar child={child} />
      </div>
    </div>
  );
}
