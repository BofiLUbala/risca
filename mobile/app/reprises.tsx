import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { api, fetcher } from '../src/lib/api';
import { ROLE_LABEL, type Role } from '../src/lib/auth';
import { Badge, Button, Card, Empty, Loading, ScreenHeader } from '../src/components/ui';
import { BackIcon } from '../src/components/icons';
import { confirmAction, notify } from '../src/lib/dialog';
import { date } from '../src/lib/format';
import { colors, radius, spacing, typography } from '../src/theme';
import { t as tx, localized } from '../src/lib/i18n';

const STATE: Record<string, { text: string; bg: string; fg: string }> = localized({
  WAITING: { text: 'Accord à donner', bg: '#FEF3C7', fg: '#92400E' },
  GRANTED: { text: 'Accord donné', bg: '#E0F2FE', fg: '#075985' },
  CLONED: { text: 'Données clonées', bg: '#D1FAE5', fg: '#065F46' },
});

/** Promotions de mon périmètre : donner l'accord de reprise et confier les responsabilités à un autre agent. */
export default function ReprisesScreen() {
  const router = useRouter();
  const { data, isLoading, mutate, isValidating } = useSWR<any[]>('/transitions', fetcher);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function grant(t: any) {
    setBusy(t.id);
    try {
      await api.post(`/transitions/${t.id}/grant`, {});
      notify(tx("Accord donné"), tx("{firstName} peut cloner les données de son ancien espace.", { firstName: t.user.firstName }));
      await mutate();
    } catch (e: any) {
      notify(tx("Action impossible"), e?.message ?? tx("Erreur"));
    }
    setBusy(null);
  }

  function handover(t: any, to: any) {
    confirmAction({
      title: tx("Transférer"),
      message: tx("Confier les responsabilités de {firstName} à {firstName1} {lastName} ?", { firstName: t.user.firstName, firstName1: to.firstName, lastName: to.lastName }),
      confirmLabel: tx("Transférer"),
      onConfirm: () =>
        void (async () => {
          setBusy(t.id);
          try {
            await api.post(`/transitions/${t.id}/handover`, { toUserId: to.id });
            setOpenId(null);
            await mutate();
          } catch (e: any) {
            notify(tx("Transfert impossible"), e?.message ?? tx("Erreur"));
          }
          setBusy(null);
        })(),
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={tx("Retour")} style={s.back} hitSlop={8}>
        <BackIcon color={colors.ink[700]} />
        <Text style={s.backText}>{tx("Retour")}</Text>
      </Pressable>
      <ScreenHeader title={tx("Reprises après promotion")} subtitle={tx("Donnez votre accord, puis confiez les responsabilités à un autre agent.")} />
      <FlatList
        data={data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={isLoading ? <Loading /> : <Empty title={tx("Aucune promotion à traiter")} description={tx("Les promotions de votre périmètre apparaîtront ici.")} />}
        refreshControl={<RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => { void mutate(); }} />}
        renderItem={({ item }) => {
          const st = STATE[item.state] ?? STATE.WAITING;
          return (
            <Card style={{ gap: spacing.sm }}>
              <View style={s.top}>
                <Text style={s.name}>
                  {item.user.firstName} {item.user.lastName}
                </Text>
                <Badge text={st.text} tone={{ bg: st.bg, fg: st.fg }} />
              </View>
              <Text style={s.meta}>
                {ROLE_LABEL[item.fromRole as Role]} → {ROLE_LABEL[item.toRole as Role]}{' '}{tx("· promu le")}{' '}{date(item.promotedAt)}
              </Text>
              {item.state === 'WAITING' ? <Button title={tx("Donner l’accord de reprise")} onPress={() => grant(item)} loading={busy === item.id} /> : null}
              {item.handedOverAt ? (
                <Text style={s.meta}>
                  {tx("Responsabilités confiées à")}{' '}{item.handedOverTo?.firstName} {item.handedOverTo?.lastName}{' '}{tx("le")}{' '}{date(item.handedOverAt)}.
                </Text>
              ) : openId === item.id ? (
                <Candidates item={item} onPick={(u) => handover(item, u)} onClose={() => setOpenId(null)} />
              ) : (
                <Button title={tx("Confier à un autre agent")} variant="outline" onPress={() => setOpenId(item.id)} />
              )}
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Candidates({ item, onPick, onClose }: { item: any; onPick: (u: any) => void; onClose: () => void }) {
  const { data } = useSWR<any[]>(`/users?role=${item.fromRole}`, fetcher);
  const rows = (data ?? []).filter((u) => u.id !== item.user.id && u.status === 'ACTIVE' && u.province?.id === item.user.provinceId);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{tx("Choisir l’agent qui reprend")}</Text>
      {!rows.length ? <Text style={s.meta}>{tx("Aucun autre agent actif dans cette province.")}</Text> : null}
      {rows.map((u) => (
        <Pressable key={u.id} onPress={() => onPick(u)} accessibilityRole="button" style={s.pick}>
          <Text style={s.pickText}>
            {u.firstName} {u.lastName}
          </Text>
        </Pressable>
      ))}
      <Button title={tx("Annuler")} variant="ghost" onPress={onClose} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, minHeight: 44 },
  backText: { ...typography.small, color: colors.ink[700] },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  name: { ...typography.bodyMedium, color: colors.ink[900], flex: 1 },
  meta: { ...typography.small, color: colors.ink[500] },
  label: { ...typography.small, fontWeight: '500', color: colors.ink[700] },
  pick: { borderWidth: 1, borderColor: colors.ink[200], borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.white },
  pickText: { ...typography.small, color: colors.ink[800] },
});
