import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { fetcher } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { Composer } from '../../src/components/Composer';
import { PostCard } from '../../src/components/PostCard';
import { Empty, Loading } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isDonor = user?.role === 'DONOR' || user?.role === 'PARTNER';
  const [scope, setScope] = useState<'mine' | 'all'>(isDonor ? 'mine' : 'all');

  const { data, isLoading, mutate, isValidating } = useSWR<any>(
    scope === 'mine' ? '/posts/my-feed?take=20' : '/posts/feed?take=20',
    fetcher,
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Espace de communication</Text>
        {isDonor ? (
          <View style={s.toggle}>
            <Pressable
              onPress={() => setScope('mine')}
              style={[s.toggleBtn, scope === 'mine' && s.toggleActive]}
            >
              <Text style={[s.toggleText, scope === 'mine' && s.toggleTextActive]}>Mes enfants</Text>
            </Pressable>
            <Pressable
              onPress={() => setScope('all')}
              style={[s.toggleBtn, scope === 'all' && s.toggleActive]}
            >
              <Text style={[s.toggleText, scope === 'all' && s.toggleTextActive]}>Réseau</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Composer onPublished={() => mutate()} />}
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : (
            <Empty
              title="Le fil est vide"
              description="Les nouvelles des enfants et des structures apparaîtront ici."
            />
          )
        }
        renderItem={({ item }) => (
          <PostCard post={item} onSupport={(childId) => router.push(`/enfant/${childId}`)} />
        )}
        refreshControl={
          <RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => mutate()} />
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.ink[950] },
  toggle: { flexDirection: 'row', backgroundColor: colors.ink[100], borderRadius: radius.lg, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.white },
  toggleText: { ...typography.caption, color: colors.ink[500] },
  toggleTextActive: { color: colors.ink[900] },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.md, paddingBottom: spacing['4xl'] },
});
