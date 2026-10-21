import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { fetcher, mediaUrl } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { Avatar, Badge, Empty, Loading } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function ChildrenScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isDonor = user?.role === 'DONOR' || user?.role === 'PARTNER';

  if (isDonor) return <PublicChildren />;
  return <ScopedChildren />;
}

/** Vue bailleur : profils publics a soutenir. */
function PublicChildren() {
  const router = useRouter();
  const { data, isLoading, mutate, isValidating } = useSWR<any[]>(
    '/children/public/feed?take=40',
    fetcher,
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Text style={s.title}>Enfants à soutenir</Text>
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={s.grid}
        ListEmptyComponent={isLoading ? <Loading /> : <Empty title="Aucun profil public" />}
        refreshControl={
          <RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => mutate()} />
        }
        renderItem={({ item }) => {
          const photo = mediaUrl(item.publicPhotoUrl);
          return (
            <Pressable
              onPress={() => router.push(`/enfant/${item.id}`)}
              style={s.tile}
              accessibilityRole="button"
            >
              <View style={s.tilePhoto}>
                {photo ? (
                  <Image source={{ uri: photo }} style={s.tileImg} resizeMode="cover" />
                ) : (
                  <Text style={s.tileInitial}>{item.firstName[0]}</Text>
                )}
                {!item.hasSponsor ? (
                  <View style={s.tileBadge}>
                    <Text style={s.tileBadgeText}>Sans parrain</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.tileBody}>
                <Text style={s.tileName} numberOfLines={1}>
                  {item.firstName}
                  {item.age != null ? `, ${item.age} ans` : ''}
                </Text>
                <Text style={s.tileMeta} numberOfLines={1}>
                  {item.region}
                </Text>
                {item.publicNeeds ? (
                  <Text style={s.tileNeed} numberOfLines={2}>
                    {item.publicNeeds}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

/** Vue reseau : dossiers du périmètre de l utilisateur. */
function ScopedChildren() {
  const router = useRouter();
  const { data, isLoading, mutate, isValidating } = useSWR<any>('/children?take=60', fetcher);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Text style={s.title}>Enfants</Text>
      <Text style={s.subtitle}>
        {data ? `${data.total} dossier(s) dans votre périmètre` : 'Chargement...'}
      </Text>

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(c: any) => c.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={isLoading ? <Loading /> : <Empty title="Aucun dossier" />}
        refreshControl={
          <RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => mutate()} />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/enfant-dossier/${item.id}`)}
            style={s.rowItem}
            accessibilityRole="button"
          >
            <Avatar uri={item.publicPhotoUrl} firstName={item.firstName} size={44} />
            <View style={s.rowBody}>
              <Text style={s.rowName} numberOfLines={1}>
                {item.firstName} <Text style={s.rowId}>{item.publicId}</Text>
              </Text>
              <Text style={s.rowMeta} numberOfLines={1}>
                {item.orphanage.name}
                {item.assignments?.[0]
                  ? ` - ${item.assignments[0].ambassador.firstName}`
                  : ' - sans ambassadeur'}
              </Text>
            </View>
            <Badge status={item.status} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  title: { ...typography.title, color: colors.ink[950], paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  subtitle: { ...typography.small, color: colors.ink[500], paddingHorizontal: spacing.lg, marginTop: 4 },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing['4xl'] },
  grid: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.ink[200],
    padding: spacing.md,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { ...typography.bodyMedium, color: colors.ink[900] },
  rowId: { ...typography.caption, color: colors.ink[400] },
  rowMeta: { ...typography.caption, color: colors.ink[500], marginTop: 2 },
  tile: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.ink[200],
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  tilePhoto: {
    aspectRatio: 1,
    backgroundColor: colors.risac[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileImg: { width: '100%', height: '100%' },
  tileInitial: { fontSize: 40, fontWeight: '600', color: colors.white },
  tileBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.amber,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tileBadgeText: { fontSize: 10, fontWeight: '600', color: colors.white },
  tileBody: { padding: spacing.md },
  tileName: { ...typography.bodyMedium, color: colors.ink[900] },
  tileMeta: { ...typography.caption, color: colors.ink[400], marginTop: 2 },
  tileNeed: { ...typography.caption, color: colors.risac[700], marginTop: 6, lineHeight: 15 },
});
