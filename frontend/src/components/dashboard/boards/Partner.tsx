'use client';

import Link from 'next/link';
import { Building, HandHeart, Users } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { ProjectCard } from '@/components/ProjectCard';
import { SectionTitle } from '../widgets';
import { money, num } from '@/lib/format';
import { t } from '@/lib/i18n';


export function PartnerBoard({ data }: { data: any }) {
  return (
    <>
      <div className="card card-pad flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-ink-900">
            {data.profile?.organizationName ?? t("Votre organisation")}
          </p>
          {data.profile?.organizationBio && (
            <p className="mt-1 max-w-xl text-sm text-ink-500">{data.profile.organizationBio}</p>
          )}
        </div>
        <Link href="/profil" className="btn-outline">
          {t("Modifier la fiche")}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("Contribution totale")} value={money(data.contribution.totalUsd)} tone="mint" icon={<HandHeart className="h-5 w-5" />} />
        <Stat label={t("Projets co-finances")} value={num(data.coFundedProjects.length)} tone="primary" icon={<Building className="h-5 w-5" />} />
        <Stat label={t("Partenaires du réseau")} value={num(data.partnersInNetwork)} icon={<Users className="h-5 w-5" />} />
      </div>

      <section>
        <SectionTitle
          action={
            <Link href="/projets" className="link-action">
              {t("Tous les projets")}
            </Link>
          }
        >
          {t("Projets et zones soutenus")}
        </SectionTitle>
        {data.coFundedProjects.length === 0 ? (
          <div className="card card-pad py-10 text-center">
            <p className="text-sm text-ink-500">{t("Aucun projet co-finance pour le moment.")}</p>
            <Link href="/projets-ouverts" className="btn-primary mt-4">
              {t("Decouvrir les projets")}
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.coFundedProjects.map((p: any) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
