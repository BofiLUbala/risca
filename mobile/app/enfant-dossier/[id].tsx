import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import useSWR from 'swr';
import { fetcher } from '../../src/lib/api';
import { Avatar, Badge, Card, Loading, Row, SectionTitle } from '../../src/components/ui';
import { BackIcon } from '../../src/components/icons';
import { date, label, money } from '../../src/lib/format';
import { colors, radius, spacing, typography } from '../../src/theme';

const TABS = [
  { key: 'identite', label: 'Identité' },
  { key: 'historique', label: 'Historique' },
  { key: 'sante', label: 'Santé' },
  { key: 'finance', label: 'Financement' },
];

export default function ChildDossierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState('identite');
  const { data: child, isLoading } = useSWR<any>(id ? `/children/${id}` : null, fetcher);
  const { data: timeline } = useSWR<any[]>(
    id && tab === 'historique' ? `/children/${id}/timeline` : null,
    fetcher,
  );

  if (isLoading || !child) {
    return (
      <SafeAreaView style={s.safe}>
        <Loading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <BackIcon color={colors.ink[700]} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {child.firstName}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Card>
          <View style={s.hero}>
            <Avatar uri={child.publicPhotoUrl ?? child.photoUrl} firstName={child.firstName} size={64} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.name}>{child.firstName}</Text>
              <Text style={s.meta} numberOfLines={2}>
                {child.publicId} - {child.orphanage.name}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Badge status={child.status} />
              </View>
            </View>
          </View>

          <View style={s.tags}>
            {child.warOrphan ? <Badge text="Orphelin de guerre" status="PENDING" /> : null}
            {child.displaced ? <Badge text="Deplace" status="NEEDS_CORRECTION" /> : null}
            {child.assignments?.[0] ? (
              <Badge text={`Amb. ${child.assignments[0].ambassador.firstName}`} />
            ) : null}
          </View>
        </Card>

        <View style={s.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[s.tab, tab === t.key && s.tabActive]}
            >
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'identite' ? (
          <>
            <Card>
              <SectionTitle>Identité</SectionTitle>
              <Row label="Sexe" value={child.sex === 'M' ? 'Masculin' : 'Feminin'} />
              <Row label="Date de naissance" value={date(child.birthDate)} />
              <Row label="Langues" value={child.languages?.join(', ')} />
              <Row label="Admission" value={date(child.admittedAt)} />
            </Card>

            <Card>
              <SectionTitle>Profil public</SectionTitle>
              <Text style={s.body}>{child.publicStory ?? 'Aucune histoire publiée.'}</Text>
              {child.publicNeeds ? (
                <View style={s.need}>
                  <Text style={s.needText}>{child.publicNeeds}</Text>
                </View>
              ) : null}
            </Card>

            <Card>
              <SectionTitle>Reparation et post-majorite</SectionTitle>
              <Row label="Statut FONAREV" value={child.fonarevStatus} />
              <Row label="Dossier FONAREV" value={child.fonarevFileNumber} />
              <Row
                label="Post-majorite"
                value={child.postMajorityPrepared ? 'Preparation engagee' : 'Non engagee'}
              />
            </Card>
          </>
        ) : null}

        {tab === 'historique' ? (
          <Card>
            <SectionTitle>Historique non effacable</SectionTitle>
            {!timeline?.length ? (
              <Text style={s.muted}>Aucun événement.</Text>
            ) : (
              timeline.map((e) => (
                <View key={e.id} style={s.event}>
                  <Text style={s.eventTitle}>{e.title}</Text>
                  {e.description ? <Text style={s.eventText}>{e.description}</Text> : null}
                  <Text style={s.eventMeta}>
                    {label(e.type)} - {date(e.occurredAt)}
                    {e.author ? ` - ${e.author.firstName}` : ''}
                  </Text>
                </View>
              ))
            )}
          </Card>
        ) : null}

        {tab === 'sante' ? (
          <Card>
            <SectionTitle>Volet santé</SectionTitle>
            {!child.healthRecords ? (
              <Text style={s.muted}>Confidentiel : non accessible pour votre rôle.</Text>
            ) : !child.healthRecords.length ? (
              <Text style={s.muted}>Aucune fiche enregistrée.</Text>
            ) : (
              child.healthRecords.map((h: any) => (
                <View key={h.id} style={{ marginBottom: spacing.md }}>
                  <Text style={s.eventMeta}>{date(h.recordedAt)}</Text>
                  <Row label="Groupe sanguin" value={h.bloodType} />
                  <Row label="Traitements" value={h.treatments} />
                  <Row label="Consultation" value={h.consultation} />
                </View>
              ))
            )}
          </Card>
        ) : null}

        {tab === 'finance' ? (
          <>
            <Card>
              <SectionTitle>Solde affecte</SectionTitle>
              <Text style={s.balance}>
                {money(child.ledgerAccounts?.[0]?.balance ?? 0, child.ledgerAccounts?.[0]?.currency)}
              </Text>
            </Card>
            <Card>
              <SectionTitle>Parrainages</SectionTitle>
              {!child.sponsorships?.length ? (
                <Text style={s.muted}>Aucun parrain.</Text>
              ) : (
                child.sponsorships.map((sp: any) => (
                  <Row
                    key={sp.id}
                    label={sp.scope}
                    value={`${money(sp.monthlyAmount, sp.currency)} / mois`}
                  />
                ))
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[100],
  },
  headerTitle: { ...typography.heading, color: colors.ink[900], flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  name: { ...typography.title, color: colors.ink[950] },
  meta: { ...typography.caption, color: colors.ink[500], marginTop: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink[200],
  },
  tabActive: { backgroundColor: colors.risac[600], borderColor: colors.risac[600] },
  tabText: { ...typography.caption, color: colors.ink[600] },
  tabTextActive: { color: colors.white },
  body: { ...typography.small, color: colors.ink[700], lineHeight: 20 },
  need: { marginTop: spacing.md, backgroundColor: colors.risac[50], borderRadius: radius.lg, padding: spacing.md },
  needText: { ...typography.small, color: colors.risac[800] },
  muted: { ...typography.small, color: colors.ink[400], paddingVertical: spacing.sm },
  event: { paddingVertical: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.risac[200], paddingLeft: spacing.md, marginBottom: spacing.sm },
  eventTitle: { ...typography.bodyMedium, color: colors.ink[900] },
  eventText: { ...typography.small, color: colors.ink[600], marginTop: 2 },
  eventMeta: { ...typography.caption, color: colors.ink[400], marginTop: 3 },
  balance: { fontSize: 28, fontWeight: '600', color: colors.ink[900] },
});
