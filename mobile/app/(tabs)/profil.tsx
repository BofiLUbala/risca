import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '../../src/lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSWR from 'swr';
import { fetcher } from '../../src/lib/api';
import { ROLE_LABEL, useAuth } from '../../src/lib/auth';
import { Avatar, Badge, Button, Card, Row, SectionTitle } from '../../src/components/ui';
import { relative } from '../../src/lib/format';
import { colors, spacing, typography } from '../../src/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { data: notifications } = useSWR<any[]>('/notifications', fetcher);

  if (!user) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
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
            <Row label="Pays" value={user.country?.nameFr} />
            <Row label="Province" value={user.province?.nameFr} />
            {user.orphanage ? <Row label="Structure" value={user.orphanage.name} /> : null}
            <Row label="Double authentification" value={user.twoFactorEnabled ? 'Activée' : 'Désactivée'} />
          </View>
        </Card>

        <Card>
          <SectionTitle>Notifications</SectionTitle>
          {!notifications?.length ? (
            <Text style={s.muted}>Aucune notification.</Text>
          ) : (
            notifications.slice(0, 8).map((n) => (
              <View key={n.id} style={s.notif}>
                <View style={[s.dot, { backgroundColor: n.read ? colors.ink[200] : colors.risac[500] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.notifTitle}>{n.title}</Text>
                  {n.body ? <Text style={s.notifBody}>{n.body}</Text> : null}
                  <Text style={s.notifMeta}>{relative(n.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <Card>
          <SectionTitle>Protection de l’enfant</SectionTitle>
          <Text style={s.policy}>
            Consentement photo obligatoire avant toute publication. Aucun contact direct entre un
            bailleur et un enfant. La localisation precise est masquee en zone a risque. Le nom de
            famille n’apparait jamais en public.
          </Text>
        </Card>

        <Button
          title="Se déconnecter"
          variant="outline"
          onPress={() =>
            confirmAction({
              title: 'Déconnexion',
              message: 'Voulez-vous vous déconnecter ?',
              confirmLabel: 'Se déconnecter',
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
