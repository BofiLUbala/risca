'use client';

import Link from 'next/link';
import { Activity, Building2, CheckCircle2, LifeBuoy, ShieldAlert, Users, Wallet } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { CountRow, MoneyRow, Progress, SectionTitle } from '../widgets';
import { label } from '@/lib/roles';
import { money, num } from '@/lib/format';
import { t } from '@/lib/i18n';


export function SuperAdminBoard({ data }: { data: any }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t("Connectés maintenant")}
          value={num(data.realtime.onlineNow)}
          hint={t("{v0} connexions sur 24 h", { v0: num(data.realtime.loginsLast24h) })}
          tone="mint"
          icon={<Activity className="h-5 w-5" />}
        />
        <Stat
          label={t("Utilisateurs")}
          value={num(data.users.total)}
          hint={t("{v0} actifs · {v1} invités", { v0: num(data.users.active), v1: num(data.users.invited) })}
          tone="primary"
          icon={<Users className="h-5 w-5" />}
        />
        <Stat
          label={t("Enfants suivis")}
          value={num(data.children.total)}
          hint={`${num(data.orphanages.total)} structures`}
          tone="primary"
          icon={<Building2 className="h-5 w-5" />}
        />
        <Stat
          label={t("Fonds collectés")}
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
              <Link href="/enfants" className="link-action">
                {t("Voir les dossiers")}
              </Link>
            }
          >
            {t("Dossiers enfants par statut")}
          </SectionTitle>
          <div className="space-y-0">
            {data.children.byStatus.map((s: any) => (
              <CountRow key={s.status} label={label(s.status)} value={s.count} />
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <SectionTitle>{t("Labellisation")}</SectionTitle>
          <p className="text-3xl font-semibold tracking-tight text-ink-900">
            {num(data.orphanages.labelled)}
            <span className="ml-1.5 text-base font-normal text-ink-400">
              / {num(data.orphanages.target)}
            </span>
          </p>
          <p className="mb-4 mt-1 text-sm text-ink-500">{t("structures labellisées")}</p>
          <Progress value={data.orphanages.labelled} total={data.orphanages.target} label={t("Objectif du réseau")} />
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle>{t("Files en attente")}</SectionTitle>
          <CountRow label={t("Validations en attente")} value={data.queues.pendingApprovals} href="/validations" />
          <CountRow label={t("Signalements ouverts")} value={data.queues.openReports} href="/moderation" />
          <CountRow label={t("Tickets de support")} value={data.queues.openTickets} href="/support" />
        </section>

        <section className="card card-pad">
          <SectionTitle>{t("Sécurité des comptes")}</SectionTitle>
          <CountRow label={t("Connexions réussies (24 h)")} value={data.realtime.loginsLast24h} />
          <CountRow label={t("Connexions échouées (24 h)")} value={data.realtime.failedLoginsLast24h} />
          <CountRow label={t("Comptes bloqués à l’activation")} value={data.realtime.blockedAtActivation} />
          <CountRow label={t("Comptes suspendus ou bloqués")} value={data.users.blocked} />
        </section>

        <section className="card card-pad">
          <SectionTitle>{t("Flux financiers")}</SectionTitle>
          <MoneyRow label={t("Compte central")} value={data.money.centralBalance} />
          <MoneyRow label={t("Fonds général")} value={data.money.generalFundBalance} />
          <MoneyRow label={t("Frais prélevés")} value={data.money.feesCollected} />
          <MoneyRow label={t("Total décaissé")} value={data.money.totalDisbursed} strong />
        </section>
      </div>

      <section className="card card-pad">
        <SectionTitle>{t("Carte mondiale des utilisateurs")}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.worldMap
            .slice()
            .sort((a: any, b: any) => b.users - a.users)
            .map((c: any) => (
              <div key={c.countryId} className="rounded-xl bg-ink-50 px-4 py-3">
                <p className="text-sm font-medium text-ink-800">{c.name ?? c.iso2}</p>
                <p className="mt-0.5 text-xs text-ink-500">{num(c.users)}{' '}{t("utilisateurs")}</p>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
