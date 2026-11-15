import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { api, fetcher } from '../src/lib/api';
import { ROLE_LABEL, useAuth, type Role } from '../src/lib/auth';
import { Badge, Button, Card, Empty, Loading, ScreenHeader, SectionTitle } from '../src/components/ui';
import { BackIcon } from '../src/components/icons';
import { confirmAction, notify } from '../src/lib/dialog';
import { date } from '../src/lib/format';
import { colors, radius, spacing, typography } from '../src/theme';

const STATUS: Record<string, { text: string; bg: string; fg: string }> = {
  SUBMITTED: { text: 'Chez le Super Admin n°1', bg: '#FEF3C7', fg: '#92400E' },
  FORWARDED: { text: 'Transmise, en lecture', bg: '#E0F2FE', fg: '#075985' },
  APPROVED: { text: 'Validée', bg: '#D1FAE5', fg: '#065F46' },
  REJECTED: { text: 'Refusée', bg: '#FEE2E2', fg: '#991B1B' },
  EXECUTED: { text: 'Promotion faite', bg: colors.ink[100], fg: colors.ink[700] },
};

const who = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : '—');

/**
 * Lettres de promotion du chef régional : on écrit au Super Admin, qui tranche (ou transmet au n°2 / n°3).
 * Une lettre validée ouvre l'espace de promotion. Le Super Admin lit et valide depuis le site web.
 */
export default function LettresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, mutate, isValidating } = useSWR<any[]>('/promotions/letters', fetcher);
  const [busy, setBusy] = useState<string | null>(null);
  const approved = (data ?? []).filter((l) => l.status === 'APPROVED');

  function promote(l: any) {
    confirmAction({
      title: 'Promouvoir',
      message: `${who(l.candidate)} deviendra ${ROLE_LABEL[l.requestedRole as Role]}. Continuer ?`,
      confirmLabel: 'Promouvoir',
      onConfirm: () => void doPromote(l),
    });
  }

  async function doPromote(l: any) {
    setBusy(l.id);
    try {
      await api.post(`/promotions/letters/${l.id}/execute`, {});
      notify('Promotion faite', `${who(l.candidate)} est maintenant ${ROLE_LABEL[l.requestedRole as Role]}.`);
      await mutate();
    } catch (e: any) {
      notify('Promotion impossible', e?.message ?? 'Erreur');
    }
    setBusy(null);
  }

  if (user && user.role !== 'REGIONAL_MANAGER') {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={s.back} hitSlop={8}>
          <BackIcon color={colors.ink[700]} />
          <Text style={s.backText}>Retour</Text>
        </Pressable>
        <Empty title="Réservé au chef régional" description="Les lettres de promotion sont écrites par les chefs régionaux." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={s.back} hitSlop={8}>
        <BackIcon color={colors.ink[700]} />
        <Text style={s.backText}>Retour</Text>
      </Pressable>
      <ScreenHeader title="Lettres de promotion" subtitle="Écrivez au Super Admin, puis promouvez quand la lettre est validée." />
      <View style={s.action}>
        <Button title="Écrire une lettre" onPress={() => router.push('/lettre-nouvelle' as never)} />
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(l) => l.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          approved.length ? (
            <View style={s.space}>
              <SectionTitle>Espace de promotion</SectionTitle>
              {approved.map((l) => (
                <View key={l.id} style={s.promoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{who(l.candidate)}</Text>
                    <Text style={s.meta}>
                      {ROLE_LABEL[l.candidate.role as Role]} → {ROLE_LABEL[l.requestedRole as Role]}
                    </Text>
                  </View>
                  <Button title="Promouvoir" onPress={() => promote(l)} loading={busy === l.id} />
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={isLoading ? <Loading /> : <Empty title="Aucune lettre" description="Écrivez votre première lettre de promotion." />}
        refreshControl={<RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => { void mutate(); }} />}
        renderItem={({ item }) => {
          const st = STATUS[item.status] ?? STATUS.SUBMITTED;
          return (
            <Card>
              <View style={s.top}>
                <Text style={s.name}>{item.subject}</Text>
                <Badge text={st.text} tone={{ bg: st.bg, fg: st.fg }} />
              </View>
              <Text style={s.meta}>
                {who(item.candidate)} ·{' '}
                {item.status === 'EXECUTED'
                  ? `promu : ${ROLE_LABEL[item.requestedRole as Role]}`
                  : `${ROLE_LABEL[item.candidate.role as Role]} → ${ROLE_LABEL[item.requestedRole as Role]}`}
              </Text>
              <Text style={s.meta}>Écrite le {date(item.createdAt)}</Text>
              {item.decisionNote ? <Text style={s.note}>« {item.decisionNote} »</Text> : null}
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, minHeight: 44 },
  backText: { ...typography.small, color: colors.ink[700] },
  action: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  space: { backgroundColor: '#ECFDF5', borderRadius: radius['2xl'], borderWidth: 1, borderColor: '#A7F3D0', padding: spacing.lg, gap: spacing.md, marginBottom: spacing.md },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  name: { ...typography.bodyMedium, color: colors.ink[900], flex: 1 },
  meta: { ...typography.small, color: colors.ink[500], marginTop: 4 },
  note: { ...typography.small, color: colors.ink[700], marginTop: 8 },
});
