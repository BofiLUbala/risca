import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { fetcher } from '../src/lib/api';
import { ROLE_LABEL, type Role } from '../src/lib/auth';
import { Card, Empty, Loading, ScreenHeader, SectionTitle } from '../src/components/ui';
import { BackIcon } from '../src/components/icons';
import { date } from '../src/lib/format';
import { colors, spacing, typography } from '../src/theme';

function Rows({ rows, render }: { rows: any[]; render: (r: any) => string }) {
  if (!rows.length) return <Text style={s.muted}>Rien à afficher.</Text>;
  return (
    <View style={{ gap: 6 }}>
      {rows.slice(0, 30).map((r, i) => (
        <Text key={i} style={s.row}>
          {render(r)}
        </Text>
      ))}
      {rows.length > 30 ? <Text style={s.muted}>… et {rows.length - 30} autre(s)</Text> : null}
    </View>
  );
}

/** Copie en lecture seule de l'ancien espace, faite après l'accord du chef régional ou national. */
export default function AncienEspaceScreen() {
  const router = useRouter();
  const { data: mine, isLoading } = useSWR<any>('/transitions/mine', fetcher);
  const { data: archive, isLoading: loadingArchive } = useSWR<any>(mine?.clonedAt ? `/transitions/${mine.id}/archive` : null, fetcher);
  const snap = archive?.snapshot;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={s.back} hitSlop={8}>
        <BackIcon color={colors.ink[700]} />
        <Text style={s.backText}>Retour</Text>
      </Pressable>
      {isLoading || loadingArchive ? (
        <Loading />
      ) : !snap ? (
        <Empty title="Pas encore de données clonées" description="Clonez vos données depuis l’Accueil, une fois l’accord de votre responsable donné." />
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <ScreenHeader title="Mon ancien espace" subtitle={`Copie en lecture seule de votre espace ${ROLE_LABEL[snap.fromRole as Role]}, faite le ${date(snap.takenAt)}.`} />
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Mes tâches en cours</SectionTitle>
            <Text style={s.row}>Demandes en attente : {snap.tasks.open.requestsPending}</Text>
            <Text style={s.row}>Dossiers d’enfants en cours : {snap.tasks.open.childRecordsInProgress}</Text>
            <Text style={s.row}>Orphelinats proposés en attente : {snap.tasks.open.orphanageProposalsPending}</Text>
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Responsabilités : enfants suivis ({snap.responsibilities.childAssignments.length})</SectionTitle>
            <Rows rows={snap.responsibilities.childAssignments} render={(r) => `${r.childPublicId} · ${r.orphanage ?? '—'} · depuis ${date(r.since)}`} />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Responsabilités : orphelinats ({snap.responsibilities.orphanages.length})</SectionTitle>
            <Rows rows={snap.responsibilities.orphanages} render={(r) => `${r.name} · depuis ${date(r.since)}`} />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Mes demandes ({snap.tasks.requests.length})</SectionTitle>
            <Rows rows={snap.tasks.requests} render={(r) => `${r.label} · ${r.status} · ${date(r.at)}`} />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Publications ({snap.posts.length}) · photos ({snap.photos.length})</SectionTitle>
            <Rows rows={snap.posts} render={(r) => `${date(r.at)} · ${r.content}`} />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Historique : dossiers saisis ({snap.history.childrenRecorded.length})</SectionTitle>
            <Rows rows={snap.history.childrenRecorded} render={(r) => `${r.publicId} · ${r.orphanage ?? '—'} · ${r.status} · ${date(r.at)}`} />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Historique : orphelinats proposés ({snap.history.orphanagesProposed.length})</SectionTitle>
            <Rows rows={snap.history.orphanagesProposed} render={(r) => `${r.name} · ${r.status} · ${date(r.at)}`} />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Historique : visites ({snap.history.visits.length})</SectionTitle>
            <Rows rows={snap.history.visits} render={(r) => `${date(r.at)} · ${r.childPublicId ?? 'Visite'}`} />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <SectionTitle>Historique : actions récentes ({snap.history.recentActions.length})</SectionTitle>
            <Rows rows={snap.history.recentActions} render={(r) => `${date(r.at)} · ${r.action}`} />
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  scroll: { paddingBottom: spacing['4xl'], gap: spacing.md, paddingHorizontal: spacing.lg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, minHeight: 44 },
  backText: { ...typography.small, color: colors.ink[700] },
  row: { ...typography.small, color: colors.ink[800] },
  muted: { ...typography.small, color: colors.ink[500] },
});
