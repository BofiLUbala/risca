'use client';

import useSWR from 'swr';
import { Target } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { ProjectCard, type PublicProject } from '@/components/ProjectCard';
import { Empty } from '@/components/ui/Empty';
import { SkeletonList } from '@/components/ui/Loading';

export default function PublicProjectsPage() {
  const { data, isLoading } = useSWR<PublicProject[]>('/projects/public?take=60', fetcher);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
          Projets ouverts au financement
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
          Chaque projet est valid&eacute; par l&apos;ambassadeur de l&apos;enfant avant publication.
          Un projet ne re&ccedil;oit plus de dons une fois son objectif atteint.
        </p>
      </header>

      <div className="mt-8">
        {isLoading ? (
          <SkeletonList rows={3} />
        ) : !data?.length ? (
          <Empty icon={<Target className="h-6 w-6" />} title="Aucun projet publie pour le moment" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <ProjectCard key={p.id} project={p} headingLevel="h2" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
