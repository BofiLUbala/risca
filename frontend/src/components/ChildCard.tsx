'use client';

import Link from 'next/link';
import { HeartHandshake, MapPin, Sparkles } from 'lucide-react';
import { mediaUrl } from '@/lib/api';
import { SafeImage } from '@/components/ui/SafeImage';

export interface PublicChild {
  id: string;
  publicId: string;
  firstName: string;
  sex: string;
  age?: number | null;
  publicPhotoUrl?: string | null;
  publicStory?: string | null;
  publicNeeds?: string | null;
  warOrphan?: boolean;
  displaced?: boolean;
  hasSponsor?: boolean;
  region?: string;
  orphanage?: { name: string; country?: { nameFr: string; iso2: string } };
}

export function ChildCard({ child, headingLevel = 'h3' }: { child: PublicChild; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  const photo = mediaUrl(child.publicPhotoUrl);

  return (
    <Link
      href={`/enfants-a-soutenir/${child.id}`}
      className="group card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-risac-100 to-risac-200">
        {photo ? (
          <SafeImage
            src={photo}
            alt={child.firstName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            fallback={
              <div className="grid h-full place-items-center text-5xl font-semibold text-white/70">
                {child.firstName[0]}
              </div>
            }
          />
        ) : (
          <div className="grid h-full place-items-center text-5xl font-semibold text-white/70">
            {child.firstName[0]}
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {child.warOrphan && (
            <span className="chip bg-white/90 text-risac-700 backdrop-blur">Orphelin de guerre</span>
          )}
          {child.displaced && (
            <span className="chip bg-white/90 text-ink-700 backdrop-blur">Déplacé</span>
          )}
        </div>

        {!child.hasSponsor && (
          <span className="absolute right-3 top-3 chip bg-accent-amber/95 text-white">
            <Sparkles className="h-3 w-3" />
            Sans parrain
          </span>
        )}
      </div>

      <div className="card-pad">
        <div className="flex items-baseline justify-between gap-2">
          <Heading className="truncate text-base font-semibold text-ink-900">{child.firstName}</Heading>
          {child.age != null && <span className="shrink-0 text-sm text-ink-500">{child.age} ans</span>}
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {child.region}
            {child.orphanage?.country ? ` · ${child.orphanage.country.nameFr}` : ''}
          </span>
        </p>

        {child.publicStory && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600">{child.publicStory}</p>
        )}

        {child.publicNeeds && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-risac-50 px-3 py-2 text-xs text-risac-700">
            <HeartHandshake className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{child.publicNeeds}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
