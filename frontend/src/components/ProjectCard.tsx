'use client';

import Link from 'next/link';
import { money, percent } from '@/lib/format';
import { mediaUrl } from '@/lib/api';
import { SafeImage } from '@/components/ui/SafeImage';
import { Badge } from '@/components/ui/Badge';

export interface PublicProject {
  id: string;
  title: string;
  description: string;
  status: string;
  category?: string | null;
  targetAmount: number;
  collectedAmount: number;
  currency: string;
  photos?: string[];
  child?: { id: string; firstName: string; publicPhotoUrl?: string | null } | null;
  orphanage?: { id: string; name: string; province?: { nameFr: string } } | null;
  _count?: { donations: number };
}

export function ProjectCard({
  project,
  headingLevel = 'h3',
}: {
  project: PublicProject;
  headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  const pct = percent(project.collectedAmount, project.targetAmount);
  const photo = mediaUrl(project.photos?.[0] ?? project.child?.publicPhotoUrl);

  return (
    <Link
      href={`/projets-ouverts/${project.id}`}
      className="group card flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-risac-100 to-risac-300">
        {photo && (
          <SafeImage
            src={photo}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        <span className="absolute left-3 top-3">
          <Badge status={project.status} />
        </span>
      </div>

      <div className="card-pad flex flex-1 flex-col">
        {project.category && (
          <p className="text-xs font-semibold text-risac-700">
            {project.category}
          </p>
        )}
        <Heading className="mt-1 line-clamp-2 text-base font-semibold text-ink-900">{project.title}</Heading>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-ink-600">
          {project.description}
        </p>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-risac-400 to-risac-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-ink-900">
              {money(project.collectedAmount, project.currency)}
            </span>
            <span className="text-xs text-ink-400">
              sur {money(project.targetAmount, project.currency)} · {pct} %
            </span>
          </div>
          {project.orphanage && (
            <p className="mt-2 truncate text-xs text-ink-400">
              {project.orphanage.name}
              {project.orphanage.province ? ` · ${project.orphanage.province.nameFr}` : ''}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
