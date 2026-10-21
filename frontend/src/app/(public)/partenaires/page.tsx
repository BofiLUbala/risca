'use client';

import useSWR from 'swr';
import { SafeImage } from '@/components/ui/SafeImage';
import { Handshake } from 'lucide-react';
import { fetcher, mediaUrl } from '@/lib/api';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';

export default function PartnersPage() {
  const { data, isLoading } = useSWR<any[]>('/users/partners', fetcher);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
          Partenaires du r&eacute;seau
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
          Organisations qui co-financent les projets et soutiennent les structures d&apos;accueil.
        </p>
      </header>

      <div className="mt-8">
        {isLoading ? (
          <SkeletonList rows={2} />
        ) : !data?.length ? (
          <Empty icon={<Handshake className="h-6 w-6" />} title="Aucun partenaire publie" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <article key={p.id} className="card card-pad">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-risac-100 text-risac-700">
                    <SafeImage
                      src={mediaUrl(p.organizationLogo)}
                      className="h-full w-full object-cover"
                      fallback={<Handshake className="h-5 w-5" />}
                    />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-ink-900">{p.organizationName}</h2>
                    {p.country && <p className="text-xs text-ink-400">{p.country.nameFr}</p>}
                  </div>
                </div>
                {p.organizationBio && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{p.organizationBio}</p>
                )}
                {p.website && (
                  <a
                    href={p.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm text-risac-600 hover:text-risac-700"
                  >
                    Voir le site
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
