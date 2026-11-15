import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { api, fetcher } from '../lib/api';
import { ROLE_LABEL, type Role } from '../lib/auth';
import { Button, Card } from './ui';
import { date } from '../lib/format';
import { colors, spacing, typography } from '../theme';

type Mine = {
  id: string;
  fromRole: Role;
  toRole: Role;
  promotedAt: string;
  state: 'WAITING' | 'GRANTED' | 'CLONED';
  grantedBy: { firstName: string; lastName: string } | null;
  clonedAt: string | null;
  handedOverAt: string | null;
  handedOverTo: { firstName: string; lastName: string } | null;
};

/**
 * Fenêtre de reprise de l'ancien espace, sur l'Accueil de n'importe quel rôle après une promotion.
 * Deux conditions pour cloner : avoir été promu, et que le chef régional ou national ait donné son accord.
 */
export function TransitionBanner() {
  const router = useRouter();
  const { data, mutate } = useSWR<Mine | null>('/transitions/mine', fetcher);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  async function clone() {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/transitions/${data.id}/clone`, {});
      await mutate();
    } catch (e: any) {
      setError(e?.message ?? 'Clonage impossible');
    }
    setBusy(false);
  }

  const who = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : '');

  return (
    <Card style={s.card}>
      <Text style={s.title}>Votre ancien espace</Text>
      <Text style={s.text}>
        Vous avez été promu : {ROLE_LABEL[data.fromRole]} → {ROLE_LABEL[data.toRole]} le {date(data.promotedAt)}. Vos données de l’ancien rôle (publications et
        photos, responsabilités, tâches, historique) restent récupérables.
      </Text>

      {data.state === 'WAITING' ? (
        <Text style={s.wait}>En attente de l’accord de votre chef régional ou national : dès qu’il l’aura donné, vous pourrez cloner vos données ici.</Text>
      ) : null}

      {data.state === 'GRANTED' ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={s.ok}>Accord donné par {who(data.grantedBy)}.</Text>
          <Button title="Cloner mes données" onPress={clone} loading={busy} />
          {error ? <Text style={s.err}>{error}</Text> : null}
        </View>
      ) : null}

      {data.state === 'CLONED' ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={s.ok}>Données clonées le {date(data.clonedAt)}.</Text>
          <Button title="Voir mon ancien espace" variant="outline" onPress={() => router.push('/ancien-espace' as never)} />
        </View>
      ) : null}

      {data.handedOverAt ? (
        <Text style={s.meta}>Vos responsabilités en cours ont été confiées à {who(data.handedOverTo)} le {date(data.handedOverAt)}.</Text>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: spacing.sm, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  title: { ...typography.bodyMedium, color: colors.ink[900] },
  text: { ...typography.small, color: colors.ink[700], lineHeight: 19 },
  wait: { ...typography.small, color: '#92400E', lineHeight: 19 },
  ok: { ...typography.small, color: '#065F46' },
  err: { ...typography.small, color: '#991B1B' },
  meta: { ...typography.caption, color: colors.ink[500] },
});
