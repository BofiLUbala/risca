import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../../src/lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { fetcher } from '../../src/lib/api';
import { ROLE_LABEL, useAuth } from '../../src/lib/auth';
import { Avatar, Badge, Button, Card, Row, SectionTitle } from '../../src/components/ui';
import { relative } from '../../src/lib/format';
import { colors, spacing, typography } from '../../src/theme';
import { t, geoName } from '../../src/lib/i18n';
import { Tr } from '../../src/lib/i18n/dynamic';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { data: notifications } = useSWR<any[]>('/notifications', fetcher);

  if (!user) return null;

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Card>
          <View style={s.head}>
            <Avatar uri={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size={64} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.name}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={s.email} numberOfLines={1}>
                {user.email}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Badge text={ROLE_LABEL[user.role]} status="PENDING" />
              </View>
            </View>
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Row label={t("Pays")} value={geoName(user.country)} />
            <Row label={t("Province")} value={geoName(user.province)} />
            {user.orphanage ? <Row label={t("Structure")} value={user.orphanage.name} /> : null}
            <Row label={t("Double authentification")} value={user.twoFactorEnabled ? t("Activée") : t("Désactivée")} />
          </View>
        </Card>

        {['NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'FIELD_AGENT', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR'].includes(user.role) ? (
          <Card>
            <SectionTitle>{t("Mon espace")}</SectionTitle>
            <View style={{ gap: spacing.sm }}>
              <Button title={t("Orphelinats")} variant="outline" onPress={() => router.push('/orphelinats' as never)} />
              {user.role === 'REGIONAL_MANAGER' ? (
                <Button title={t("Lettres de promotion")} variant="outline" onPress={() => router.push('/lettres' as never)} />
              ) : null}
              {user.role === 'REGIONAL_MANAGER' || user.role === 'NATIONAL_MANAGER' ? (
                <Button title={t("Reprises après promotion")} variant="outline" onPress={() => router.push('/reprises' as never)} />
              ) : null}
            </View>
          </Card>
        ) : null}

        <Card>
          <SectionTitle>{t("Notifications")}</SectionTitle>
          {!notifications?.length ? (
            <Text style={s.muted}>{t("Aucune notification.")}</Text>
          ) : (
            notifications.slice(0, 5).map((n) => (
              <View key={n.id} style={s.notif}>
                <View style={[s.dot, { backgroundColor: n.read ? colors.ink[200] : colors.risac[500] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.notifTitle}><Tr text={n.title} /></Text>
                  {n.body ? <Text style={s.notifBody}><Tr text={n.body} /></Text> : null}
                  <Text style={s.notifMeta}>{relative(n.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <Card>
          <SectionTitle>{t("Protection de l’enfant")}</SectionTitle>
          <Text style={s.policy}>
            {t("Consentement photo obligatoire avant toute publication. Aucun contact direct entre un bailleur et un enfant. La localisation precise est masquee en zone a risque. Le nom de famille n’apparait jamais en public.")}
          </Text>
        </Card>

        <Button
          title={t("Se déconnecter")}
          variant="outline"
          onPress={() =>
            confirmAction({
              title: t("Déconnexion"),
              message: t("Voulez-vous vous déconnecter ?"),
              confirmLabel: t("Se déconnecter"),
              destructive: true,
              onConfirm: () => logout(),
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  name: { ...typography.title, color: colors.ink[950] },
  email: { ...typography.small, color: colors.ink[500], marginTop: 2 },
  muted: { ...typography.small, color: colors.ink[400], paddingVertical: spacing.sm },
  notif: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[100],
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notifTitle: { ...typography.bodyMedium, color: colors.ink[900] },
  notifBody: { ...typography.small, color: colors.ink[600], marginTop: 2 },
  notifMeta: { ...typography.caption, color: colors.ink[400], marginTop: 3 },
  policy: { ...typography.small, color: colors.ink[600], lineHeight: 20 },
});
