'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Bookmark, Newspaper } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Composer } from '@/components/feed/Composer';
import { PostCard } from '@/components/feed/PostCard';
import { FeedFilters, type FeedFilterState, type ScopeOption } from '@/components/feed/FeedFilters';
import { Avatar } from '@/components/ui/Avatar';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';

/** Rôles qui peuvent publier, donc qui ont un onglet « Mes publications ». */
const AUTHORS = [
  'AMBASSADOR',
  'ORPHANAGE_DIRECTOR',
  'REGIONAL_MANAGER',
  'NATIONAL_MANAGER',
  'SUPER_ADMIN',
  'MODERATOR',
];

/**
 * Espace de communication (section 8) : le fil ou les publications apparaissent.
 * Quatre perimetres selon le role : tout le reseau, mes enfants, mes publications
 * (avec leur audience) et mes favoris.
 */
export default function CommunicationPage() {
  const { user } = useAuth();
  const isDonor = user?.role === 'DONOR' || user?.role === 'PARTNER';
  const isAuthor = AUTHORS.includes(user?.role ?? '');

  const scopes: ScopeOption[] = [
    ...(isDonor ? ([{ value: 'mine', label: 'Mes enfants' }] as ScopeOption[]) : []),
    { value: 'all', label: 'Tout le réseau' },
    ...(isAuthor ? ([{ value: 'authored', label: 'Mes publications' }] as ScopeOption[]) : []),
    { value: 'favorites', label: 'Favoris' },
  ];

  const [filters, setFilters] = useState<FeedFilterState>({
    scope: isDonor ? 'mine' : 'all',
    type: '',
    countryId: '',
  });

  const params = new URLSearchParams({ take: '20' });
  if (filters.type) params.set('type', filters.type);
  if (filters.countryId) params.set('countryId', filters.countryId);

  const key =
    filters.scope === 'mine'
      ? '/posts/my-feed?take=20'
      : filters.scope === 'authored'
        ? '/posts/mine'
        : filters.scope === 'favorites'
          ? '/posts/favorites'
          : `/posts/feed?${params.toString()}`;

  const { data, isLoading, mutate } = useSWR<any>(key, fetcher);

  // Les trois formes de réponse de l’API : { items }, { posts, totals }, Favorite[].
  const posts: any[] =
    filters.scope === 'authored' ? (data?.posts ?? []) : filters.scope === 'favorites' ? [] : (data?.items ?? []);

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-5">
      <h1 className="sr-only">Espace de communication</h1>
      <FeedFilters value={filters} onChange={setFilters} scopes={scopes} />

      {(filters.scope === 'all' || filters.scope === 'mine') && <Composer onPublished={() => mutate()} />}

      {filters.scope === 'authored' && data?.totals && (
        <div className="card card-pad grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Vues', value: data.totals.views },
            { label: 'Réactions', value: data.totals.reactions },
            { label: 'Commentaires', value: data.totals.comments },
          ].map((t) => (
            <div key={t.label}>
              <p className="text-xl font-semibold tabular-nums text-ink-900">{t.value ?? 0}</p>
              <p className="meta">{t.label}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : filters.scope === 'favorites' ? (
        !data?.length ? (
          <Empty
            icon={<Bookmark className="h-6 w-6" />}
            title="Aucun favori"
            description="Le marque-page d’une publication ajoute l’enfant ou le projet ici."
          />
        ) : (
          <ul className="card divide-y divide-ink-100 overflow-hidden">
            {data.map((f: any) => (
              <li key={f.id}>
                <Link
                  href={f.child ? `/enfants-a-soutenir/${f.child.id}` : `/projets-ouverts/${f.projectId}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-ink-50 sm:px-5"
                >
                  <Avatar src={f.child?.publicPhotoUrl} firstName={f.child?.firstName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {f.child ? f.child.firstName : 'Projet'}
                    </p>
                    <p className="truncate meta">{f.child?.publicNeeds ?? f.child?.publicId ?? ''}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : !posts.length ? (
        <Empty
          icon={<Newspaper className="h-6 w-6" />}
          title={filters.scope === 'authored' ? 'Vous n’avez rien publié' : 'Le fil est vide'}
          description={
            filters.scope === 'authored'
              ? 'Vos publications et leur audience apparaîtront ici.'
              : 'Les nouvelles des enfants et des structures apparaîtront ici.'
          }
        />
      ) : (
        <div className="space-y-5">
          {posts.map((p: any) => (
            <PostCard key={p.id} post={p} onChange={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  );
}
