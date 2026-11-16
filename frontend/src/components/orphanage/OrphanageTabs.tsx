'use client';
import { promptDialog } from '@/lib/dialog';

import { Field } from '@/components/child/Tabs';
import { Badge } from '@/components/ui/Badge';
import { date, money, num } from '@/lib/format';
import { AmbassadorLinks } from './AmbassadorLinks';
import { HistoryForm } from './HistoryForm';
import { t, localized } from '@/lib/i18n';


/** Nature de l'evenement d'historique, en francais. */
const HISTORY_KIND: Record<string, string> = localized({
  VISIT: 'Visite',
  AUDIT: 'Audit',
  INCIDENT: 'Incident',
  TRAINING: 'Formation',
  OTHER: 'Autre',
});

export function OrphanageTabs({
  tab,
  orphanage: o,
  canDecide,
  onAct,
  onRefresh,
}: {
  tab: string;
  orphanage: any;
  canDecide: boolean;
  onAct: (path: string, body?: any) => void;
  /** Recharge la fiche après un rattachement ou un nouvel événement. */
  onRefresh: () => void;
}) {
  if (tab === 'identite') {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 card-title">{t("Identité legale")}</h2>
          <dl>
            <Field label={t("Statut juridique")} value={o.legalStatus} />
            <Field label={t("Numéro d’agrement")} value={o.licenseNumber} />
            <Field label={t("Date de création")} value={date(o.foundedAt)} />
            <Field label={t("Documents legaux")} value={`${o.legalDocs?.length ?? 0} piece(s)`} />
            <Field
              label={t("Chef d’orphelinat")}
              value={o.director ? `${o.director.firstName} ${o.director.lastName}` : null}
            />
          </dl>
        </section>
        <section className="card card-pad">
          <h2 className="mb-3 card-title">{t("Localisation")}</h2>
          <dl>
            <Field label={t("Ville")} value={o.city} />
            <Field label={t("Commune")} value={o.commune} />
            <Field label={t("Adresse")} value={o.address ?? t("Masquee (zone a risque)")} />
            <Field label={t("Zone a risque")} value={o.province.riskZone ? t("Oui") : t("Non")} />
          </dl>
        </section>
      </div>
    );
  }

  if (tab === 'capacite') {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 card-title">{t("Places")}</h2>
          <dl>
            <Field label={t("Places totales")} value={num(o.totalPlaces)} />
            <Field label={t("Places occupées")} value={num(o.occupiedPlaces)} />
            <Field label={t("Enfants suivis")} value={num(o._count?.children)} />
          </dl>
        </section>
        <section className="card card-pad">
          <h2 className="mb-3 card-title">{t("Infrastructures")}</h2>
          <dl>
            <Field label={t("Dortoirs")} value={o.hasDormitory ? t("Oui") : t("Non")} />
            <Field label={t("Eau potable")} value={o.hasDrinkingWater ? t("Oui") : t("Non")} />
            <Field label={t("Electricite")} value={o.hasElectricity ? t("Oui") : t("Non")} />
            <Field label={t("Ecole sur place")} value={o.hasSchool ? t("Oui") : t("Non")} />
            <Field label={t("Infirmerie")} value={o.hasInfirmary ? t("Oui") : t("Non")} />
          </dl>
        </section>
        {o.urgentNeeds ? (
          <section className="card card-pad lg:col-span-2">
            <h2 className="mb-2 card-title">{t("Besoins urgents")}</h2>
            <p className="text-sm text-ink-600">{o.urgentNeeds}</p>
          </section>
        ) : null}
      </div>
    );
  }

  if (tab === 'label') {
    return <LabelTab orphanage={o} canDecide={canDecide} onAct={onAct} />;
  }

  if (tab === 'finances') {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 card-title">{t("Compte vérifié")}</h2>
          <dl>
            <Field label={t("Mobile money")} value={o.mobileMoneyProvider} />
            <Field label={t("Numéro")} value={o.mobileMoneyNumber} />
            <Field label={t("Compte bancaire")} value={o.bankAccountName} />
            <Field label={t("Vérification")} value={o.accountVerified ? t("Compte vérifié") : t("Non vérifié")} />
          </dl>
          {!o.accountVerified ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              {t("Tant que le compte n’est pas vérifié, aucun décaissement n’est possible.")}
            </p>
          ) : null}
        </section>
        <section className="card card-pad">
          <h2 className="mb-3 card-title">{t("Soldes")}</h2>
          <dl>
            {o.ledgerAccounts?.map((a: any) => (
              <Field key={a.id} label={a.label} value={money(a.balance, a.currency)} />
            ))}
            <Field label={t("Décaissements")} value={num(o._count?.disbursements)} />
            <Field label={t("Projets")} value={num(o._count?.projects)} />
          </dl>
        </section>
      </div>
    );
  }

  if (tab === 'equipe') {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 card-title">{t("Personnel")}</h2>
          {!o.members?.length ? (
            <p className="text-sm text-ink-400">{t("Aucun membre enregistré.")}</p>
          ) : (
            <dl>
              {o.members.map((m: any) => (
                <Field
                  key={m.id}
                  label={`${m.firstName} ${m.lastName}`}
                  value={`${m.role}${m.staffFunction ? ` - ${m.staffFunction}` : ''}`}
                />
              ))}
            </dl>
          )}
        </section>
        <section className="card card-pad">
          <h2 className="mb-3 card-title">{t("Ambassadeurs rattachés")}</h2>
          <AmbassadorLinks orphanageId={o.id} links={o.ambassadors} onChange={onRefresh} />
        </section>
      </div>
    );
  }

  return (
    <section className="card card-pad space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="card-title">{t("Visites, audits, incidents")}</h2>
        <HistoryForm orphanageId={o.id} onAdded={onRefresh} />
      </div>
      {!o.historyEntries?.length ? (
        <p className="text-sm text-ink-400">{t("Aucun événement.")}</p>
      ) : (
        <ol className="space-y-3">
          {o.historyEntries.map((h: any) => (
            <li key={h.id} className="border-l-2 border-risac-200 pl-4">
              <p className="text-sm font-medium text-ink-800">{h.title}</p>
              {h.description ? <p className="text-sm text-ink-600">{h.description}</p> : null}
              <p className="mt-0.5 text-xs text-ink-400">
                {HISTORY_KIND[h.kind] ?? h.kind} &middot; {date(h.occurredAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Candidature, audit sur place, decision (section 4). */
function LabelTab({
  orphanage: o,
  canDecide,
  onAct,
}: {
  orphanage: any;
  canDecide: boolean;
  onAct: (path: string, body?: any) => void;
}) {
  async function schedule() {
    const d = await promptDialog(t("Date de l’audit sur place (AAAA-MM-JJ) ?"));
    if (d) onAct('label/schedule', { scheduledAt: d });
  }

  async function decide(result: string) {
    const conditions =
      result === 'COMPLIANT_WITH_CONDITIONS' ? await promptDialog(t("Conditions a respecter ?")) : null;
    const notes = await promptDialog(t("Notes de l’audit (facultatif)")) ?? undefined;
    onAct('label/decide', { result, conditions: conditions ?? undefined, notes });
  }

  return (
    <div className="space-y-5">
      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="card-title">{t("Statut actuel")}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge status={o.labelStatus} />
              {o.labelGrantedAt ? (
                <span className="text-xs text-ink-500">{t("accorde le")}{' '}{date(o.labelGrantedAt)}</span>
              ) : null}
              {o.labelExpiresAt ? (
                <span className="text-xs text-ink-500">{t("expire le")}{' '}{date(o.labelExpiresAt)}</span>
              ) : null}
            </div>
          </div>

          {canDecide ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={schedule} className="btn-outline">
                {t("Planifier l’audit")}
              </button>
              <button onClick={() => decide('COMPLIANT')} className="btn-primary">
                {t("Conforme")}
              </button>
              <button onClick={() => decide('COMPLIANT_WITH_CONDITIONS')} className="btn-outline">
                {t("Sous conditions")}
              </button>
              <button onClick={() => decide('NON_COMPLIANT')} className="btn-ghost text-accent-coral">
                {t("Non conforme")}
              </button>
            </div>
          ) : null}
        </div>

        <p className="mt-4 rounded-xl bg-risac-50 px-3.5 py-2.5 text-xs text-risac-800">
          {t("Regle de confiance : seul un orphelinat labellise, dont le compte est vérifié, peut recevoir des fonds.")}
        </p>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">{t("Historique des audits")}</h2>
        {!o.labelAudits?.length ? (
          <p className="text-sm text-ink-400">{t("Aucun audit enregistré.")}</p>
        ) : (
          <div className="space-y-3">
            {o.labelAudits.map((a: any) => (
              <div key={a.id} className="rounded-xl bg-ink-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge status={a.result} />
                  <span className="text-xs text-ink-400">
                    {a.performedAt
                      ? t("realise le {v0}", { v0: date(a.performedAt) })
                      : a.scheduledAt
                        ? t("planifie le {v0}", { v0: date(a.scheduledAt) })
                        : date(a.createdAt)}
                  </span>
                </div>
                {a.conditions ? (
                  <p className="mt-2 text-sm text-ink-700">{t("Conditions :")}{' '}{a.conditions}</p>
                ) : null}
                {a.notes ? <p className="mt-1 text-sm text-ink-600">{a.notes}</p> : null}
                {a.score != null ? (
                  <p className="mt-1 text-xs text-ink-500">{t("Score :")}{' '}{a.score}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
