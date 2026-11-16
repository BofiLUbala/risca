'use client';

import Link from 'next/link';
import { Building2, ClipboardList, UserPlus } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { SectionTitle } from '../widgets';
import { num } from '@/lib/format';
import { t } from '@/lib/i18n';

export function AgentBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("Enfants recenses")} value={num(data.childrenRecorded)} tone="primary" icon={<UserPlus className="h-5 w-5" />} />
        <Stat label={t("En attente de validation")} value={num(data.pendingValidation)} tone="amber" icon={<ClipboardList className="h-5 w-5" />} />
        <Stat label={t("Structures de ma région")} value={num(data.orphanagesInRegion)} icon={<Building2 className="h-5 w-5" />} />
      </div>

      <section className="card card-pad">
        <SectionTitle>{t("Actions de terrain")}</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <Link href="/enfants/nouveau" className="btn-primary">
            <UserPlus className="h-4 w-4" />
            {t("Recenser un enfant")}
          </Link>
          <Link href="/orphelinats/nouveau" className="btn-outline">
            <Building2 className="h-4 w-4" />
            {t("Proposer un orphelinat")}
          </Link>
          <Link href="/support" className="btn-ghost">
            {t("Signaler une urgence")}
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-400">
          {t("Vos saisies sont soumises a la validation de l’ambassadeur puis du chef regional.")}
        </p>
      </section>
    </>
  );
}
