import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Progress, Row, SectionTitle, Stat } from './ui';
import { money, num } from '../lib/format';
import { colors, spacing, typography } from '../theme';
import { t } from '../lib/i18n';
import { Tr } from '../lib/i18n/dynamic';

/** Tableau de bord mobile, adapte au role (section 11). */
export function Board({ data }: { data: any }) {
  switch (data.role) {
    case 'AMBASSADOR':
      return <AmbassadorBoard data={data} />;
    case 'ORPHANAGE_DIRECTOR':
      return <DirectorBoard data={data} />;
    case 'DONOR':
    case 'PARTNER':
      return <DonorBoard data={data} />;
    default:
      return <GenericBoard data={data} />;
  }
}

function AmbassadorBoard({ data }: { data: any }) {
  return (
    <>
      <View style={s.grid}>
        <Stat label={t("Mes enfants")} value={num(data.myChildren)} icon="children" tone="navy" />
        <Stat label={t("À valider")} value={num(data.validationQueue)} icon="validate" tone="sun" />
      </View>
      <View style={s.grid}>
        <Stat label={t("Décaissements à confirmer")} value={num(data.disbursementsToConfirm)} icon="transfer" tone="violet" />
        <Stat label={t("Fonds levés")} value={money(data.fundsRaised)} icon="heart" tone="mint" />
      </View>

      <Card>
        <SectionTitle action={data.alerts.length ? <Badge text={String(data.alerts.length)} status="NEEDS_CORRECTION" /> : undefined}>{t("Rappels")}</SectionTitle>
        {data.alerts.length === 0 ? (
          <Text style={s.muted}>{t("Aucun rappel en cours.")}</Text>
        ) : (
          data.alerts.slice(0, 5).map((a: any, i: number) => (
            <View key={i} style={s.alert}>
              <Text style={s.alertTitle}>
                {a.firstName} ({a.publicId})
              </Text>
              <Text style={s.alertText}><Tr text={a.message} /></Text>
            </View>
          ))
        )}
        {data.alerts.length > 5 ? (
          <Text style={s.more}>{t('… et')} {data.alerts.length - 5} {t('autre(s)')}</Text>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>{t("Mes publications")}</SectionTitle>
        <Row label={t("Publications")} value={num(data.publications.count)} />
        <Row label={t("Vues")} value={num(data.publications.views)} />
        <Row label={t("Réactions")} value={num(data.publications.reactions)} />
        <Row label={t("Rapports de visite")} value={num(data.visitReports)} />
      </Card>
    </>
  );
}

function DirectorBoard({ data }: { data: any }) {
  return (
    <>
      {data.orphanage ? (
        <Card>
          <Text style={s.cardTitle}>{data.orphanage.name}</Text>
          <View style={s.badgeRow}>
            <Badge status={data.orphanage.labelStatus} />
            {!data.orphanage.accountVerified ? (
              <Badge text={t("Compte non vérifié")} status="NEEDS_CORRECTION" />
            ) : null}
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Row
              label={t("Places occupées")}
              value={`${num(data.orphanage.occupiedPlaces)} / ${num(data.orphanage.totalPlaces)}`}
            />
          </View>
        </Card>
      ) : null}

      <View style={s.grid}>
        <Stat label={t("Enfants")} value={num(data.children.total)} icon="children" tone="navy" />
        <Stat label={t("Solde")} value={money(data.balance.balance)} icon="heart" tone="mint" />
      </View>

      <Card>
        <SectionTitle>{t("Mes dossiers")}</SectionTitle>
        <Row label={t("Brouillons")} value={num(data.children.draft)} />
        <Row label={t("En validation")} value={num(data.children.inValidation)} />
        <Row label={t("À corriger")} value={num(data.children.needsCorrection)} />
        <Row label={t("Justificatifs attendus")} value={num(data.disbursements.awaitingReceipts)} />
      </Card>
    </>
  );
}

function DonorBoard({ data }: { data: any }) {
  return (
    <>
      <View style={s.grid}>
        <Stat
          label={t("Total donné")}
          icon="heart"
          tone="mint"
          value={money(data.impact?.totalDonatedUsd ?? data.contribution?.totalUsd ?? 0)}
        />
        <Stat label={t("Enfants soutenus")} value={num(data.impact?.childrenSupported ?? 0)} icon="children" tone="navy" />
      </View>

      {data.sponsorships?.length > 0 ? (
        <Card>
          <SectionTitle>{t("Mes filleuls")}</SectionTitle>
          {data.sponsorships.map((sp: any) => (
            <Row
              key={sp.id}
              label={sp.child.firstName}
              value={`${money(sp.monthlyAmount, sp.currency)} / mois`}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{t("Mon impact")}</SectionTitle>
        <Row label={t("Dons effectués")} value={num(data.impact?.donationCount ?? 0)} />
        <Row label={t("Projets soutenus")} value={num(data.impact?.projectsSupported ?? 0)} />
        <Row label={t("Preuves de dépense")} value={num(data.impact?.proofsAvailable ?? 0)} />
      </Card>
    </>
  );
}

function GenericBoard({ data }: { data: any }) {
  return (
    <>
      {data.children ? (
        <View style={s.grid}>
          <Stat label={t("Enfants")} value={num(data.children.total ?? data.children)} icon="children" tone="navy" />
          <Stat
            label={t("Structures")}
            icon="orphanage"
            tone="sun"
            value={num(data.orphanages?.total ?? data.region?.orphanages ?? data.country?.orphanages ?? 0)}
          />
        </View>
      ) : null}

      {data.money ? (
        <Card>
          <SectionTitle>{t("Flux financiers")}</SectionTitle>
          <Row label={t("Compte central")} value={money(data.money.centralBalance)} />
          <Row label={t("Fonds général")} value={money(data.money.generalFundBalance)} />
          <Row label={t("Total décaissé")} value={money(data.money.totalDisbursed)} />
        </Card>
      ) : null}

      {data.orphanages?.target ? (
        <Card>
          <SectionTitle>{t("Labellisation")}</SectionTitle>
          <Text style={s.bigNumber}>
            {num(data.orphanages.labelled)}
            <Text style={s.bigNumberSub}> / {num(data.orphanages.target)}</Text>
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <Progress value={data.orphanages.labelled} total={data.orphanages.target} />
          </View>
        </Card>
      ) : null}

      {data.queues ? (
        <Card>
          <SectionTitle>{t("Files en attente")}</SectionTitle>
          <Row label={t("Validations")} value={num(data.queues.pendingApprovals)} />
          <Row label={t("Signalements")} value={num(data.queues.openReports)} />
          <Row label={t("Tickets")} value={num(data.queues.openTickets)} />
        </Card>
      ) : null}

      {data.region ? (
        <Card>
          <SectionTitle>{t("Ma région")}</SectionTitle>
          <Row label={t("Orphelinats")} value={num(data.region.orphanages)} />
          <Row label={t("Enfants")} value={num(data.region.children)} />
          <Row label={t("Ambassadeurs")} value={num(data.region.ambassadors)} />
          <Row label={t("À valider")} value={num(data.validationQueue)} />
        </Card>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.md },
  cardTitle: { ...typography.heading, color: colors.ink[900] },
  badgeRow: { marginTop: 8, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  muted: { ...typography.small, color: colors.ink[400], paddingVertical: spacing.md },
  alert: {
    backgroundColor: colors.amberSoft,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  more: { ...typography.small, color: colors.ink[500], textAlign: 'center', marginTop: spacing.xs },
  alertTitle: { ...typography.bodyMedium, color: colors.ink[800] },
  alertText: { ...typography.small, color: colors.ink[600], marginTop: 2 },
  bigNumber: { fontSize: 30, fontWeight: '600', color: colors.ink[900] },
  bigNumberSub: { fontSize: 16, fontWeight: '400', color: colors.ink[400] },
});
