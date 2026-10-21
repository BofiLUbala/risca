'use client';

import { Building2, Landmark, MapPin, Users } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { CountRow, MoneyRow, Progress, SectionTitle } from '../widgets';
import { money, num } from '@/lib/format';

const FONAREV_LABEL: Record<string, string> = {
  IDENTIFIED: 'Identifie',
  ORIENTED: 'Oriente',
  FILED: 'Dossier depose',
  REPARATION_OBTAINED: 'Reparation obtenue',
};

export function NationalBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Orphelinats"
          value={num(data.country.orphanages)}
          hint={`${num(data.country.labelled)} labellises`}
          tone="primary"
          icon={<Building2 className="h-5 w-5" />}
        />
        <Stat label="Enfants suivis" value={num(data.country.children)} tone="primary" icon={<Users className="h-5 w-5" />} />
        <Stat label="Fonds reçus" value={money(data.funds.received)} tone="mint" icon={<Landmark className="h-5 w-5" />} />
        <Stat label="Fonds décaissés" value={money(data.funds.disbursed)} tone="amber" icon={<Landmark className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <SectionTitle>Comparaison des régions</SectionTitle>
          <div className="space-y-2">
            {data.byProvince
              .slice()
              .sort((a: any, b: any) => b.orphanages - a.orphanages)
              .map((p: any) => (
                <div key={p.provinceId} className="flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3">
                  <MapPin className="h-4 w-4 shrink-0 text-ink-400" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                    {p.name}
                    {p.riskZone && (
                      <span className="ml-2 chip bg-amber-100 text-amber-700">zone a risque</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                    {num(p.orphanages)}
                  </span>
                </div>
              ))}
          </div>
        </section>

        <div className="space-y-5">
          <section className="card card-pad">
            <SectionTitle>Labellisation du pays</SectionTitle>
            <Progress
              value={data.country.labelled}
              total={data.country.orphanages || 1}
              label={`${num(data.country.labelled)} sur ${num(data.country.orphanages)} structures`}
            />
          </section>

          <section className="card card-pad">
            <SectionTitle>Encadrement</SectionTitle>
            <CountRow label="Chefs regionaux" value={data.country.regionalManagers} />
            <CountRow label="Ambassadeurs" value={data.country.ambassadors} />
            <CountRow
              label="Régions couvertes"
              value={data.country.regionsCovered ?? 0}
              hint={`sur ${num(data.country.regions)} provinces`}
            />
          </section>
        </div>
      </div>

      <section className="card card-pad">
        <SectionTitle>Orientation FONAREV</SectionTitle>
        {data.fonarev.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">Aucune orientation enregistrée.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.fonarev.map((f: any) => (
              <div key={f.status} className="rounded-xl bg-risac-50 px-4 py-3">
                <p className="text-sm font-medium text-risac-800">
                  {FONAREV_LABEL[f.status] ?? f.status}
                </p>
                <p className="mt-1 text-2xl font-semibold text-risac-900">{num(f.count)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
