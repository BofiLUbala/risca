import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { notify } from '../../src/lib/dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSWR from 'swr';
import { api, fetcher } from '../../src/lib/api';
import { Badge, Button, Card, Empty, Loading } from '../../src/components/ui';
import { relative } from '../../src/lib/format';
import { colors, radius, spacing, typography } from '../../src/theme';

const KIND_LABEL: Record<string, string> = {
  CHILD_DOSSIER: 'Nouveau dossier enfant',
  CHILD_UPDATE: 'Mise à jour de dossier',
  PROJECT: 'Projet',
  ORPHANAGE_CREATION: 'Nouvel orphelinat',
  ORPHANAGE_UPDATE: 'Fiche orphelinat',
  LABEL_APPLICATION: 'Labellisation',
};

export default function ValidationsScreen() {
  const { data, isLoading, mutate, isValidating } = useSWR<any[]>('/approvals/queue', fetcher);
  const [openId, setOpenId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: 'approve' | 'request-changes' | 'reject') {
    if (action !== 'approve' && comment.trim().length < 3) {
      notify('Motif requis', 'Un motif est obligatoire pour cette décision.');
      return;
    }
    setBusy(action);
    try {
      await api.post(`/approvals/${id}/${action}`, { comment });
      setComment('');
      setOpenId(null);
      mutate();
    } catch (e: any) {
      notify('Action impossible', e?.message ?? 'Erreur');
    }
    setBusy(null);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Ma file de validation</Text>
        <Text style={s.subtitle}>
          {data ? `${data.length} element(s) attendent votre decision` : 'Chargement...'}
        </Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : (
            <Empty title="Rien à valider" description="Votre file est vide pour le moment." />
          )
        }
        refreshControl={
          <RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => mutate()} />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.kind}>{KIND_LABEL[item.kind] ?? item.kind}</Text>
                <Text style={s.label}>{item.entityLabel ?? item.kind}</Text>
                <Text style={s.meta}>
                  {relative(item.createdAt)} - etape {item.currentStepOrder}
                  {item.escalated ? ' - remontee' : ''}
                </Text>
              </View>
              <Badge status={item.status} />
            </View>

            {openId === item.id ? (
              <View style={s.decision}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Commentaire (obligatoire pour un refus)"
                  placeholderTextColor={colors.ink[400]}
                  multiline
                  style={s.input}
                />
                <View style={s.actions}>
                  <Button
                    title="Valider"
                    onPress={() => act(item.id, 'approve')}
                    loading={busy === 'approve'}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Corrections"
                    variant="outline"
                    onPress={() => act(item.id, 'request-changes')}
                    style={{ flex: 1 }}
                  />
                </View>
                <Button title="Refuser" variant="danger" onPress={() => act(item.id, 'reject')} />
              </View>
            ) : (
              <Button
                title="Decider"
                variant="soft"
                onPress={() => setOpenId(item.id)}
                style={{ marginTop: spacing.md }}
              />
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { ...typography.title, color: colors.ink[950] },
  subtitle: { ...typography.small, color: colors.ink[500], marginTop: 4 },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  kind: { ...typography.caption, color: colors.risac[600] },
  label: { ...typography.bodyMedium, color: colors.ink[900], marginTop: 3 },
  meta: { ...typography.caption, color: colors.ink[400], marginTop: 3 },
  decision: { marginTop: spacing.md, gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 76,
    fontSize: 14,
    color: colors.ink[900],
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
