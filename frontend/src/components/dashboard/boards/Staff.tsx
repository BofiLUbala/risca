'use client';

import Link from 'next/link';
import { Brain, GraduationCap, HeartPulse, Users } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { SectionTitle } from '../widgets';
import { num } from '@/lib/format';

const FUNCTION_LABEL: Record<string, string> = {
  PSYCHOLOGIST: 'Psychologue',
  EDUCATOR: 'Educateur',
  NURSE: 'Infirmier',
  SOCIAL_WORKER: 'Assistant social',
};

export function StaffBoard({ data }: { data: any }) {
  const isPsy = data.staffFunction === 'PSYCHOLOGIST';
  const isEdu = data.staffFunction === 'EDUCATOR';

  return (
    <>
      <div className="rounded-2xl border border-risac-200 bg-risac-50/70 px-5 py-4 text-sm text-risac-800">
        {FUNCTION_LABEL[data.staffFunction] ?? 'Personnel'} de la structure. Votre acces est limite a
        votre orphelinat et à votre fonction.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Enfants de la structure" value={num(data.children)} tone="primary" icon={<Users className="h-5 w-5" />} />

        {isPsy && (
          <>
            <Stat label="Seances realisees" value={num(data.sessions)} tone="primary" icon={<Brain className="h-5 w-5" />} />
            <Stat
              label="Sans evaluation initiale"
              value={num(data.childrenWithoutInitialAssessment)}
              tone="amber"
              icon={<Brain className="h-5 w-5" />}
            />
          </>
        )}

        {isEdu && (
          <>
            <Stat label="Bulletins saisis" value={num(data.schoolRecords)} tone="primary" icon={<GraduationCap className="h-5 w-5" />} />
            <Stat
              label="Sans bulletin"
              value={num(data.childrenWithoutRecord)}
              tone="amber"
              icon={<GraduationCap className="h-5 w-5" />}
            />
          </>
        )}

        {!isPsy && !isEdu && (
          <Stat label="Fiches santé saisies" value={num(data.healthRecords)} tone="primary" icon={<HeartPulse className="h-5 w-5" />} />
        )}
      </div>

      <section className="card card-pad">
        <SectionTitle>Actions</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <Link href="/enfants" className="btn-soft">
            Voir les enfants de la structure
          </Link>
          {isPsy && (
            <span className="chip bg-ink-100 text-ink-600">
              Les séances psychotrauma restent confidentielles
            </span>
          )}
        </div>
      </section>
    </>
  );
}
