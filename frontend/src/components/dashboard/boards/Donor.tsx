'use client';

import Link from 'next/link';
import { SafeImage } from '@/components/ui/SafeImage';
import { FileCheck, Heart, Sparkles, Users } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { Avatar } from '@/components/ui/Avatar';
import { SectionTitle } from '../widgets';
import { money, num, relative } from '@/lib/format';
import { mediaUrl } from '@/lib/api';

export function DonorBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total donné" value={money(data.impact.totalDonatedUsd)} tone="mint" icon={<Heart className="h-5 w-5" />} />
        <Stat label="Enfants soutenus" value={num(data.impact.childrenSupported)} tone="primary" icon={<Users className="h-5 w-5" />} />
        <Stat
          label="Engagement mensuel"
          value={money(data.monthlyCommitment)}
          hint={`${num(data.sponsorships.length)} parrainages actifs`}
          tone="primary"
          icon={<Sparkles className="h-5 w-5" />}
        />
        <Stat
          label="Preuves de dépense"
          value={num(data.impact.proofsAvailable)}
          tone="amber"
          icon={<FileCheck className="h-5 w-5" />}
        />
      </div>

      <section className="card card-pad">
        <SectionTitle
          action={
            <Link href="/mes-parrainages" className="text-sm font-medium text-risac-600 hover:text-risac-700">
              Gérer
            </Link>
          }
        >
          Mes filleuls
        </SectionTitle>
        {data.sponsorships.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink-500">Vous ne parrainez aucun enfant pour le moment.</p>
            <Link href="/enfants-a-soutenir" className="btn-primary mt-4">
              Decouvrir les enfants
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.sponsorships.map((s: any) => (
              <Link
                key={s.id}
                href={`/enfants-a-soutenir/${s.child.id}`}
                className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-3 transition-colors hover:border-risac-200 hover:bg-risac-50/40"
              >
                <Avatar src={s.child.publicPhotoUrl} firstName={s.child.firstName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    {s.child.firstName}
                  </span>
                  <span className="block text-xs text-ink-400">
                    {money(s.monthlyAmount, s.currency)} / mois
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card card-pad">
        <SectionTitle
          action={
            <Link href="/communication" className="text-sm font-medium text-risac-600 hover:text-risac-700">
              Tout le fil
            </Link>
          }
        >
          Le fil de mes enfants
        </SectionTitle>
        {data.feed.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">
            Les nouvelles de vos filleuls apparaîtront ici.
          </p>
        ) : (
          <div className="space-y-3">
            {data.feed.map((p: any) => {
              const photo = mediaUrl(p.photos?.[0]);
              return (
                <Link
                  key={p.id}
                  href={`/communication/${p.id}`}
                  className="flex gap-4 rounded-xl border border-ink-100 p-3 transition-colors hover:border-risac-200 hover:bg-risac-50/40"
                >
                  {photo && <SafeImage src={photo} className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-800">
                      {p.child?.firstName}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm text-ink-600">{p.content}</span>
                    <span className="mt-1 block text-xs text-ink-400">{relative(p.createdAt)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
