'use client';

import { Field } from '@/components/child/Tabs';
import { Badge } from '@/components/ui/Badge';
import { date, money, num } from '@/lib/format';
import { AmbassadorLinks } from './AmbassadorLinks';
import { HistoryForm } from './HistoryForm';

/** Nature de l'evenement d'historique, en francais. */
const HISTORY_KIND: Record<string, string> = {
  VISIT: 'Visite',
  AUDIT: 'Audit',
  INCIDENT: 'Incident',
  TRAINING: 'Formation',
  OTHER: 'Autre',
};

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
          <h2 className="mb-3 card-title">Identité legale</h2>
          <dl>
            <Field label="Statut juridique" value={o.legalStatus} />
            <Field label="Numéro d’agrement" value={o.licenseNumber} />
            <Field label="Date de création" value={date(o.foundedAt)} />
            <Field label="Documents legaux" value={`${o.legalDocs?.length ?? 0} piece(s)`} />
            <Field
              label="Chef d’orphelinat"
              value={o.director ? `${o.director.firstName} ${o.director.lastName}` : null}
            />
          </dl>
        </section>
        <section className="card card-pad">
          <h2 className="mb-3 card-title">Localisation</h2>
          <dl>
            <Field label="Ville" value={o.city} />
            <Field label="Commune" value={o.commune} />
            <Field label="Adresse" value={o.address ?? 'Masquee (zone a risque)'} />
            <Field label="Zone a risque" value={o.province.riskZone ? 'Oui' : 'Non'} />
          </dl>
        </section>
      </div>
    );
  }

  if (tab === 'capacite') {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 card-title">Places</h2>
          <dl>
            <Field label="Places totales" value={num(o.totalPlaces)} />
            <Field label="Places occupées" value={num(o.occupiedPlaces)} />
            <Field label="Enfants suivis" value={num(o._count?.children)} />
          </dl>
        </section>
        <section className="card card-pad">
          <h2 className="mb-3 card-title">Infrastructures</h2>
          <dl>
            <Field label="Dortoirs" value={o.hasDormitory ? 'Oui' : 'Non'} />
            <Field label="Eau potable" value={o.hasDrinkingWater ? 'Oui' : 'Non'} />
            <Field label="Electricite" value={o.hasElectricity ? 'Oui' : 'Non'} />
            <Field label="Ecole sur place" value={o.hasSchool ? 'Oui' : 'Non'} />
            <Field label="Infirmerie" value={o.hasInfirmary ? 'Oui' : 'Non'} />
          </dl>
        </section>
        {o.urgentNeeds ? (
          <section className="card card-pad lg:col-span-2">
            <h2 className="mb-2 card-title">Besoins urgents</h2>
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
          <h2 className="mb-3 card-title">Compte vérifié</h2>
          <dl>
            <Field label="Mobile money" value={o.mobileMoneyProvider} />
            <Field label="Numéro" value={o.mobileMoneyNumber} />
            <Field label="Compte bancaire" value={o.bankAccountName} />
            <Field label="Vérification" value={o.accountVerified ? 'Compte vérifié' : 'Non vérifié'} />
          </dl>
          {!o.accountVerified ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              Tant que le compte n’est pas vérifié, aucun décaissement n’est possible.
            </p>
          ) : null}
        </section>
        <section className="card card-pad">
          <h2 className="mb-3 card-title">Soldes</h2>
          <dl>
            {o.ledgerAccounts?.map((a: any) => (
              <Field key={a.id} label={a.label} value={money(a.balance, a.currency)} />
            ))}
            <Field label="Décaissements" value={num(o._count?.disbursements)} />
            <Field label="Projets" value={num(o._count?.projects)} />
          </dl>
        </section>
      </div>
    );
  }

  if (tab === 'equipe') {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-3 card-title">Personnel</h2>
          {!o.members?.length ? (
            <p className="text-sm text-ink-400">Aucun membre enregistré.</p>
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
          <h2 className="mb-3 card-title">Ambassadeurs rattachés</h2>
          <AmbassadorLinks orphanageId={o.id} links={o.ambassadors} onChange={onRefresh} />
        </section>
      </div>
    );
  }

  return (
    <section className="card card-pad space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="card-title">Visites, audits, incidents</h2>
        <HistoryForm orphanageId={o.id} onAdded={onRefresh} />
      </div>
      {!o.historyEntries?.length ? (
        <p className="text-sm text-ink-400">Aucun événement.</p>
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
  function schedule() {
    const d = window.prompt('Date de l’audit sur place (AAAA-MM-JJ) ?');
    if (d) onAct('label/schedule', { scheduledAt: d });
  }

  function decide(result: string) {
    const conditions =
      result === 'COMPLIANT_WITH_CONDITIONS' ? window.prompt('Conditions a respecter ?') : null;
    const notes = window.prompt('Notes de l’audit (facultatif)') ?? undefined;
    onAct('label/decide', { result, conditions: conditions ?? undefined, notes });
  }

  return (
    <div className="space-y-5">
      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="card-title">Statut actuel</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge status={o.labelStatus} />
              {o.labelGrantedAt ? (
                <span className="text-xs text-ink-500">accorde le {date(o.labelGrantedAt)}</span>
              ) : null}
              {o.labelExpiresAt ? (
                <span className="text-xs text-ink-500">expire le {date(o.labelExpiresAt)}</span>
              ) : null}
            </div>
          </div>

          {canDecide ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={schedule} className="btn-outline">
                Planifier l’audit
              </button>
              <button onClick={() => decide('COMPLIANT')} className="btn-primary">
                Conforme
              </button>
              <button onClick={() => decide('COMPLIANT_WITH_CONDITIONS')} className="btn-outline">
                Sous conditions
              </button>
              <button onClick={() => decide('NON_COMPLIANT')} className="btn-ghost text-accent-coral">
                Non conforme
              </button>
            </div>
          ) : null}
        </div>

        <p className="mt-4 rounded-xl bg-risac-50 px-3.5 py-2.5 text-xs text-risac-800">
          Regle de confiance : seul un orphelinat labellise, dont le compte est vérifié, peut
          recevoir des fonds.
        </p>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">Historique des audits</h2>
        {!o.labelAudits?.length ? (
          <p className="text-sm text-ink-400">Aucun audit enregistré.</p>
        ) : (
          <div className="space-y-3">
            {o.labelAudits.map((a: any) => (
              <div key={a.id} className="rounded-xl bg-ink-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge status={a.result} />
                  <span className="text-xs text-ink-400">
                    {a.performedAt
                      ? `realise le ${date(a.performedAt)}`
                      : a.scheduledAt
                        ? `planifie le ${date(a.scheduledAt)}`
                        : date(a.createdAt)}
                  </span>
                </div>
                {a.conditions ? (
                  <p className="mt-2 text-sm text-ink-700">Conditions : {a.conditions}</p>
                ) : null}
                {a.notes ? <p className="mt-1 text-sm text-ink-600">{a.notes}</p> : null}
                {a.score != null ? (
                  <p className="mt-1 text-xs text-ink-500">Score : {a.score}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
