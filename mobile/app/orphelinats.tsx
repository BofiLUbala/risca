import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { fetcher } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { Badge, Button, Card, Empty, Loading, ScreenHeader } from '../src/components/ui';
import { BackIcon } from '../src/components/icons';
import { date } from '../src/lib/format';
import { colors, spacing, typography } from '../src/theme';
import { t, geoName } from '../src/lib/i18n';

/** Mêmes rôles que `POST /orphanages` côté API. */
const CAN_CREATE = ['NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'FIELD_AGENT'];

/**
 * Orphelinats de mon périmètre : l'API ne renvoie que ceux de mon pays (responsable national) ou de ma région
 * (chef régional, agent de terrain). Le Super Admin utilise le site web.
 */
export default function OrphelinatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading, mutate, isValidating } = useSWR<any[]>('/orphanages', fetcher);
  const canCreate = !!user && CAN_CREATE.includes(user.role);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("Retour")} style={s.back} hitSlop={8}>
        <BackIcon color={colors.ink[700]} />
        <Text style={s.backText}>{t("Retour")}</Text>
      </Pressable>
      <ScreenHeader title={t("Orphelinats")} subtitle={data ? t("{length} structure(s) dans votre périmètre", { length: data.length }) : t("Chargement…")} />

      {canCreate ? (
        <View style={s.action}>
          <Button title={user?.role === 'FIELD_AGENT' ? t("Proposer un orphelinat") : t("Enregistrer un orphelinat")} onPress={() => router.push('/orphelinat-nouveau' as never)} />
        </View>
      ) : null}

      <FlatList
        data={data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={isLoading ? <Loading /> : <Empty title={t("Aucune structure")} description={t("Aucun orphelinat dans votre périmètre.")} />}
        refreshControl={<RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => { void mutate(); }} />}
        renderItem={({ item }) => (
          <Card>
            <View style={s.top}>
              <Text style={s.name}>{item.name}</Text>
              <Badge status={item.status} />
            </View>
            <Text style={s.meta}>
              {item.city ? `${item.city}, ` : ''}
              {geoName(item.province)}
            </Text>
            <Text style={s.meta}>
              {item._count?.children ?? 0}{' '}{t("enfants ·")}{' '}{item.occupiedPlaces ?? 0} / {item.totalPlaces ?? 0}{' '}{t("places")}
            </Text>
            {item.proposedBy ? (
              <Text style={s.proposed}>
                {t("Enregistré par")}{' '}{item.proposedBy.firstName} {item.proposedBy.lastName}
                {item.createdAt ? t(" le {date}", { date: date(item.createdAt) }) : ''}
              </Text>
            ) : null}
          </Card>
        )}
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
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  name: { ...typography.bodyMedium, color: colors.ink[900], flex: 1 },
  meta: { ...typography.small, color: colors.ink[500], marginTop: 4 },
  proposed: { ...typography.caption, color: colors.ink[400], marginTop: 8 },
});
