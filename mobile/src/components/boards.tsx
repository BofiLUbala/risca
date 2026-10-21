import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Progress, Row, SectionTitle, Stat } from './ui';
import { money, num } from '../lib/format';
import { colors, spacing, typography } from '../theme';

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
        <Stat label="Mes enfants" value={num(data.myChildren)} />
        <Stat label="À valider" value={num(data.validationQueue)} />
      </View>
      <View style={s.grid}>
        <Stat label="Décaissements à confirmer" value={num(data.disbursementsToConfirm)} />
        <Stat label="Fonds levés" value={money(data.fundsRaised)} />
      </View>

      <Card>
        <SectionTitle>Rappels</SectionTitle>
        {data.alerts.length === 0 ? (
          <Text style={s.muted}>Aucun rappel en cours.</Text>
        ) : (
          data.alerts.slice(0, 6).map((a: any, i: number) => (
            <View key={i} style={s.alert}>
              <Text style={s.alertTitle}>
                {a.firstName} ({a.publicId})
              </Text>
              <Text style={s.alertText}>{a.message}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>Mes publications</SectionTitle>
        <Row label="Publications" value={num(data.publications.count)} />
        <Row label="Vues" value={num(data.publications.views)} />
        <Row label="Reactions" value={num(data.publications.reactions)} />
        <Row label="Rapports de visite" value={num(data.visitReports)} />
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
              <Badge text="Compte non vérifié" status="NEEDS_CORRECTION" />
            ) : null}
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Row
              label="Places occupées"
              value={`${num(data.orphanage.occupiedPlaces)} / ${num(data.orphanage.totalPlaces)}`}
            />
          </View>
        </Card>
      ) : null}

      <View style={s.grid}>
        <Stat label="Enfants" value={num(data.children.total)} />
        <Stat label="Solde" value={money(data.balance.balance)} />
      </View>

      <Card>
        <SectionTitle>Mes dossiers</SectionTitle>
        <Row label="Brouillons" value={num(data.children.draft)} />
        <Row label="En validation" value={num(data.children.inValidation)} />
        <Row label="À corriger" value={num(data.children.needsCorrection)} />
        <Row label="Justificatifs attendus" value={num(data.disbursements.awaitingReceipts)} />
      </Card>
    </>
  );
}

function DonorBoard({ data }: { data: any }) {
  return (
    <>
      <View style={s.grid}>
        <Stat
          label="Total donné"
          value={money(data.impact?.totalDonatedUsd ?? data.contribution?.totalUsd ?? 0)}
        />
        <Stat label="Enfants soutenus" value={num(data.impact?.childrenSupported ?? 0)} />
      </View>

      {data.sponsorships?.length > 0 ? (
        <Card>
          <SectionTitle>Mes filleuls</SectionTitle>
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
        <SectionTitle>Mon impact</SectionTitle>
        <Row label="Dons effectués" value={num(data.impact?.donationCount ?? 0)} />
        <Row label="Projets soutenus" value={num(data.impact?.projectsSupported ?? 0)} />
        <Row label="Preuves de dépense" value={num(data.impact?.proofsAvailable ?? 0)} />
      </Card>
    </>
  );
}

function GenericBoard({ data }: { data: any }) {
  return (
    <>
      {data.children ? (
        <View style={s.grid}>
          <Stat label="Enfants" value={num(data.children.total ?? data.children)} />
          <Stat
            label="Structures"
            value={num(data.orphanages?.total ?? data.region?.orphanages ?? data.country?.orphanages ?? 0)}
          />
        </View>
      ) : null}

      {data.money ? (
        <Card>
          <SectionTitle>Flux financiers</SectionTitle>
          <Row label="Compte central" value={money(data.money.centralBalance)} />
          <Row label="Fonds général" value={money(data.money.generalFundBalance)} />
          <Row label="Total décaissé" value={money(data.money.totalDisbursed)} />
        </Card>
      ) : null}

      {data.orphanages?.target ? (
        <Card>
          <SectionTitle>Labellisation</SectionTitle>
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
          <SectionTitle>Files en attente</SectionTitle>
          <Row label="Validations" value={num(data.queues.pendingApprovals)} />
          <Row label="Signalements" value={num(data.queues.openReports)} />
          <Row label="Tickets" value={num(data.queues.openTickets)} />
        </Card>
      ) : null}

      {data.region ? (
        <Card>
          <SectionTitle>Ma région</SectionTitle>
          <Row label="Orphelinats" value={num(data.region.orphanages)} />
          <Row label="Enfants" value={num(data.region.children)} />
          <Row label="Ambassadeurs" value={num(data.region.ambassadors)} />
          <Row label="À valider" value={num(data.validationQueue)} />
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
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  alertTitle: { ...typography.bodyMedium, color: colors.ink[800] },
  alertText: { ...typography.small, color: colors.ink[600], marginTop: 2 },
  bigNumber: { fontSize: 30, fontWeight: '600', color: colors.ink[900] },
  bigNumberSub: { fontSize: 16, fontWeight: '400', color: colors.ink[400] },
});
