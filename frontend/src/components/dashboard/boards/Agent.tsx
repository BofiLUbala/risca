'use client';

import Link from 'next/link';
import { Building2, ClipboardList, UserPlus } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { SectionTitle } from '../widgets';
import { num } from '@/lib/format';

export function AgentBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Enfants recenses" value={num(data.childrenRecorded)} tone="primary" icon={<UserPlus className="h-5 w-5" />} />
        <Stat label="En attente de validation" value={num(data.pendingValidation)} tone="amber" icon={<ClipboardList className="h-5 w-5" />} />
        <Stat label="Structures de ma région" value={num(data.orphanagesInRegion)} icon={<Building2 className="h-5 w-5" />} />
      </div>

      <section className="card card-pad">
        <SectionTitle>Actions de terrain</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <Link href="/enfants/nouveau" className="btn-primary">
            <UserPlus className="h-4 w-4" />
            Recenser un enfant
          </Link>
          <Link href="/orphelinats/nouveau" className="btn-outline">
            <Building2 className="h-4 w-4" />
            Proposer un orphelinat
          </Link>
          <Link href="/support" className="btn-ghost">
            Signaler une urgence
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-400">
          Vos saisies sont soumises a la validation de l’ambassadeur puis du chef regional.
        </p>
      </section>
    </>
  );
}
