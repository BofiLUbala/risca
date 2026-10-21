'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, Brain, Plus, Send } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Loading';
import { Tabs, Field } from '@/components/child/Tabs';
import { Timeline } from '@/components/child/Timeline';
import { DossierFields } from '@/components/child/DossierFields';
import { AssignAmbassador } from '@/components/child/AssignAmbassador';
import { ConsentManager } from '@/components/child/ConsentManager';
import { TransferChild } from '@/components/child/TransferChild';
import { VersionHistory } from '@/components/child/VersionHistory';
import { date, money } from '@/lib/format';

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: child, isLoading, mutate } = useSWR<any>(`/children/${id}`, fetcher);
  const [tab, setTab] = useState('identite');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (isLoading || !child) return <PageLoading />;

  const canSubmit =
    ['DRAFT', 'NEEDS_CORRECTION'].includes(child.status) &&
    ['ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'FIELD_AGENT', 'SUPER_ADMIN'].includes(user?.role ?? '');

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/children/${id}/submit`);
      setMsg('Dossier soumis au circuit de validation.');
      mutate();
    } catch (e: any) {
      setMsg(e?.message ?? 'Soumission impossible');
    }
    setBusy(false);
  }

  const tabs = [
    { key: 'identite', label: 'Identité' },
    { key: 'dossier', label: 'Dossier pays' },
    { key: 'historique', label: 'Historique', count: child._count?.timeline },
    { key: 'sante', label: 'Santé', count: child.healthRecords?.length },
    { key: 'scolarite', label: 'Scolarité', count: child.schoolRecords?.length },
    { key: 'psycho', label: 'Psychotrauma', count: child.psychoSessions?.length },
    { key: 'finance', label: 'Financement' },
    { key: 'consentements', label: 'Consentements', count: child.consents?.length },
    { key: 'versions', label: 'Versions', count: child._count?.versions },
  ];

  return (
    <div className="space-y-5">
      <Link href="/enfants" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0">
        <ArrowLeft className="h-4 w-4" />
        Retour aux enfants
      </Link>

      <header className="card card-pad flex flex-wrap items-start gap-5">
        <Avatar src={child.publicPhotoUrl ?? child.photoUrl} firstName={child.firstName} size="xl" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">
              {child.firstName} {child.lastName ? child.lastName : ''}
            </h1>
            <Badge status={child.status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {child.publicId} &middot; {child.orphanage.name} &middot; {child.orphanage.province.nameFr}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {child.warOrphan && <span className="chip bg-risac-50 text-risac-700">Orphelin de guerre</span>}
            {child.displaced && <span className="chip bg-amber-50 text-amber-700">Deplace</span>}
            {child.abandoned && <span className="chip bg-ink-100 text-ink-600">Abandonne</span>}
            {child.formerArmedGroup && (
              <span className="chip bg-rose-50 text-rose-700">Ancien enfant associe aux groupes armes</span>
            )}
            {child.assignments?.[0] && (
              <span className="chip bg-ink-100 text-ink-600">
                Ambassadeur : {child.assignments[0].ambassador.firstName}{' '}
                {child.assignments[0].ambassador.lastName}
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
          {canSubmit && (
            <button onClick={submit} disabled={busy} className="btn-primary">
              <Send className="h-4 w-4" />
              Soumettre a validation
            </button>
          )}
          <AssignAmbassador
            childId={id}
            current={child.assignments?.[0]?.ambassador ?? null}
            onDone={() => mutate()}
          />
          <TransferChild
            childId={id}
            currentOrphanageId={child.orphanage.id}
            transfers={child.transfers}
            onDone={() => mutate()}
          />
          <Link href={`/enfants/${id}/mise-a-jour`} className="btn-outline">
            <Plus className="h-4 w-4" />
            Mise à jour
          </Link>
        </div>
      </header>

      {msg && (
        <div className="rounded-xl bg-risac-50 px-4 py-3 text-sm text-risac-800" role="status">
          {msg}
        </div>
      )}

      <TransferChild
        childId={id}
        currentOrphanageId={child.orphanage.id}
        transfers={child.transfers}
        slot="banner"
        onDone={() => mutate()}
      />

      {child.pendingApproval && (
        <Link
          href={`/validations/${child.pendingApproval.id}`}
          className="block rounded-xl border border-risac-200 bg-risac-50/70 px-4 py-3 text-sm text-risac-800 hover:bg-risac-50"
        >
          Un circuit de validation est en cours sur ce dossier (étape{' '}
          {child.pendingApproval.currentStepOrder}).
        </Link>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="animate-fade-up">
        {tab === 'identite' && <IdentiteTab child={child} />}
        {tab === 'dossier' && <DossierFields template={child.template} data={child.dossierData ?? {}} />}
        {tab === 'historique' && <Timeline childId={id} />}
        {tab === 'sante' && <HealthTab child={child} />}
        {tab === 'scolarite' && <SchoolTab child={child} />}
        {tab === 'psycho' && <PsychoTab child={child} />}
        {tab === 'finance' && <FinanceTab child={child} />}
        {tab === 'consentements' && <ConsentManager child={child} onChange={() => mutate()} />}
        {tab === 'versions' && <VersionHistory childId={id} />}
      </div>
    </div>
  );
}

function IdentiteTab({ child }: { child: any }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card card-pad">
        <h2 className="mb-3 card-title">Identité</h2>
        <dl>
          <Field label="Prénom" value={child.firstName} />
          {child.lastName && <Field label="Nom (confidentiel)" value={child.lastName} />}
          <Field label="Sexe" value={child.sex === 'M' ? 'Masculin' : 'Feminin'} />
          <Field label="Date de naissance" value={date(child.birthDate)} />
          {child.estimatedAge && <Field label="Age estime" value={`${child.estimatedAge} ans`} />}
          <Field label="Langues" value={child.languages?.join(', ')} />
          <Field label="Identifiant unique" value={child.publicId} />
        </dl>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">Placement</h2>
        <dl>
          <Field label="Structure" value={child.orphanage.name} />
          <Field label="Province" value={child.orphanage.province.nameFr} />
          <Field label="Pays" value={child.orphanage.country.nameFr} />
          <Field label="Date d’admission" value={date(child.admittedAt)} />
          <Field label="Motif" value={child.admissionReason} />
          <Field label="Refere par" value={child.referredBy} />
        </dl>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">Profil public</h2>
        <dl>
          <Field label="Histoire" value={child.publicStory} />
          <Field label="Besoins" value={child.publicNeeds} />
          <Field label="Projet de vie" value={child.lifeProject} />
          <Field label="Talents" value={child.talents} />
          <Field label="Métier souhaité" value={child.desiredJob} />
        </dl>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">Reparation et post-majorite</h2>
        <dl>
          <Field label="Statut FONAREV" value={child.fonarevStatus} />
          <Field label="Numéro de dossier" value={child.fonarevFileNumber} />
          <Field label="Demarches" value={child.fonarevNotes} />
          <Field
            label="Preparation post-majorite"
            value={child.postMajorityPrepared ? 'Engagee' : 'Non engagee'}
          />
          <Field label="Bourse Tremplin" value={child.tremplinScholarship ? 'Oui' : 'Non'} />
          <Field label="Mentor" value={child.mentorName} />
          <Field label="Suivi apres la sortie" value={child.aftercareNotes} />
        </dl>
      </section>
    </div>
  );
}

function HealthTab({ child }: { child: any }) {
  if (!child.healthRecords) {
    return (
      <div className="card card-pad text-sm text-ink-500">
        Le volet santé est confidentiel et n’est pas accessible pour votre rôle.
      </div>
    );
  }
  if (!child.healthRecords.length) {
    return <div className="card card-pad text-sm text-ink-400">Aucune fiche santé enregistrée.</div>;
  }
  return (
    <div className="space-y-4">
      {child.healthRecords.map((h: any) => (
        <section key={h.id} className="card card-pad">
          <p className="mb-2 text-xs text-ink-400">{date(h.recordedAt)}</p>
          <dl>
            <Field label="Groupe sanguin" value={h.bloodType} />
            <Field label="Vaccins" value={h.vaccines} />
            <Field label="Maladies" value={h.illnesses} />
            <Field label="Handicap" value={h.disability} />
            <Field label="Traitements" value={h.treatments} />
            <Field label="Consultation" value={h.consultation} />
          </dl>
        </section>
      ))}
    </div>
  );
}

function SchoolTab({ child }: { child: any }) {
  if (!child.schoolRecords?.length) {
    return <div className="card card-pad text-sm text-ink-400">Aucun bulletin enregistré.</div>;
  }
  return (
    <div className="space-y-4">
      {child.schoolRecords.map((s: any) => (
        <section key={s.id} className="card card-pad">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-ink-900">
              {s.school ?? 'Etablissement non precise'} {s.grade ? `- ${s.grade}` : ''}
            </p>
            <span className="text-xs text-ink-400">
              {s.term} {s.year}
            </span>
          </div>
          <dl className="mt-2">
            <Field label="Resultats" value={s.results} />
            <Field label="Moyenne" value={s.average} />
            <Field label="Frais scolaires" value={s.fees ? money(s.fees) : undefined} />
            <Field label="Résumé public" value={s.publicSummary} />
          </dl>
        </section>
      ))}
    </div>
  );
}

function PsychoTab({ child }: { child: any }) {
  if (!child.psychoAccessible) {
    return (
      <div className="card card-pad flex items-start gap-3 text-sm text-ink-500">
        <Brain className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
        <span>
          Volet très confidentiel. Accessible au psychologue de la structure, à l’ambassadeur assigné
          et à l’Auditeur Éthique uniquement.
        </span>
      </div>
    );
  }
  if (!child.psychoSessions?.length) {
    return <div className="card card-pad text-sm text-ink-400">Aucune séance enregistrée.</div>;
  }
  return (
    <div className="space-y-4">
      {child.psychoSessions.map((s: any) => (
        <section key={s.id} className="card card-pad border-violet-200 bg-violet-50/30">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-medium text-ink-900">
              {s.isInitialAssessment ? 'Evaluation initiale' : 'Seance de suivi'}
            </p>
            <span className="text-xs text-ink-400">{date(s.sessionAt)}</span>
          </div>
          <dl className="mt-2">
            <Field label="Evaluation" value={s.evaluation} />
            <Field label="Notes" value={s.notes} />
            <Field label="Evolution" value={s.evolution} />
          </dl>
        </section>
      ))}
    </div>
  );
}

function FinanceTab({ child }: { child: any }) {
  const account = child.ledgerAccounts?.[0];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card card-pad">
        <h2 className="mb-3 card-title">Solde affecte</h2>
        <p className="text-3xl font-semibold tracking-tight text-ink-900">
          {money(account?.balance ?? 0, account?.currency ?? 'USD')}
        </p>
        <p className="mt-1 text-sm text-ink-500">disponible pour cet enfant</p>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">Parrainages actifs</h2>
        {!child.sponsorships?.length ? (
          <p className="text-sm text-ink-400">Aucun parrain pour le moment.</p>
        ) : (
          <dl>
            {child.sponsorships.map((s: any) => (
              <Field
                key={s.id}
                label={`${s.scope} depuis le ${date(s.startDate)}`}
                value={`${money(s.monthlyAmount, s.currency)} par mois`}
              />
            ))}
          </dl>
        )}
      </section>

      <section className="card card-pad lg:col-span-2">
        <h2 className="mb-3 card-title">Projets</h2>
        {!child.projects?.length ? (
          <p className="text-sm text-ink-400">Aucun projet pour cet enfant.</p>
        ) : (
          <div className="space-y-2">
            {child.projects.map((p: any) => (
              <Link
                key={p.id}
                href={`/projets/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 hover:bg-risac-50"
              >
                <span className="min-w-0 truncate text-sm font-medium text-ink-800">{p.title}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-ink-500">
                    {money(p.collectedAmount, p.currency)} / {money(p.targetAmount, p.currency)}
                  </span>
                  <Badge status={p.status} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
