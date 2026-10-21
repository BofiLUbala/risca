'use client';

import Link from 'next/link';
import { Activity, Building2, CheckCircle2, LifeBuoy, ShieldAlert, Users, Wallet } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { CountRow, MoneyRow, Progress, SectionTitle } from '../widgets';
import { label } from '@/lib/roles';
import { money, num } from '@/lib/format';

export function SuperAdminBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Connectés maintenant"
          value={num(data.realtime.onlineNow)}
          hint={`${num(data.realtime.loginsLast24h)} connexions sur 24 h`}
          tone="mint"
          icon={<Activity className="h-5 w-5" />}
        />
        <Stat
          label="Utilisateurs"
          value={num(data.users.total)}
          hint={`${num(data.users.active)} actifs · ${num(data.users.invited)} invités`}
          tone="primary"
          icon={<Users className="h-5 w-5" />}
        />
        <Stat
          label="Enfants suivis"
          value={num(data.children.total)}
          hint={`${num(data.orphanages.total)} structures`}
          tone="primary"
          icon={<Building2 className="h-5 w-5" />}
        />
        <Stat
          label="Fonds collectés"
          value={money(data.money.totalDonated)}
          hint={`${num(data.money.donationCount)} dons`}
          tone="amber"
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <SectionTitle
            action={
              <Link href="/enfants" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                Voir les dossiers
              </Link>
            }
          >
            Dossiers enfants par statut
          </SectionTitle>
          <div className="space-y-0">
            {data.children.byStatus.map((s: any) => (
              <CountRow key={s.status} label={label(s.status)} value={s.count} />
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <SectionTitle>Labellisation</SectionTitle>
          <p className="text-3xl font-semibold tracking-tight text-ink-900">
            {num(data.orphanages.labelled)}
            <span className="ml-1.5 text-base font-normal text-ink-400">
              / {num(data.orphanages.target)}
            </span>
          </p>
          <p className="mb-4 mt-1 text-sm text-ink-500">structures labellisées</p>
          <Progress value={data.orphanages.labelled} total={data.orphanages.target} label="Objectif du réseau" />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle>Files en attente</SectionTitle>
          <CountRow label="Validations en attente" value={data.queues.pendingApprovals} href="/validations" />
          <CountRow label="Signalements ouverts" value={data.queues.openReports} href="/moderation" />
          <CountRow label="Tickets de support" value={data.queues.openTickets} href="/support" />
        </section>

        <section className="card card-pad">
          <SectionTitle>Sécurité des comptes</SectionTitle>
          <CountRow label="Connexions réussies (24 h)" value={data.realtime.loginsLast24h} />
          <CountRow label="Connexions échouées (24 h)" value={data.realtime.failedLoginsLast24h} />
          <CountRow label="Comptes bloqués à l’activation" value={data.realtime.blockedAtActivation} />
          <CountRow label="Comptes suspendus ou bloqués" value={data.users.blocked} />
        </section>

        <section className="card card-pad">
          <SectionTitle>Flux financiers</SectionTitle>
          <MoneyRow label="Compte central" value={data.money.centralBalance} />
          <MoneyRow label="Fonds général" value={data.money.generalFundBalance} />
          <MoneyRow label="Frais prélevés" value={data.money.feesCollected} />
          <MoneyRow label="Total décaissé" value={data.money.totalDisbursed} strong />
        </section>
      </div>

      <section className="card card-pad">
        <SectionTitle>Carte mondiale des utilisateurs</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.worldMap
            .slice()
            .sort((a: any, b: any) => b.users - a.users)
            .map((c: any) => (
              <div key={c.countryId} className="rounded-xl bg-ink-50 px-4 py-3">
                <p className="text-sm font-medium text-ink-800">{c.name ?? c.iso2}</p>
                <p className="mt-0.5 text-xs text-ink-500">{num(c.users)} utilisateurs</p>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
