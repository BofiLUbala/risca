import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSWR from 'swr';
import { fetcher } from '../../src/lib/api';
import { ROLE_LABEL, useAuth } from '../../src/lib/auth';
import { Loading, ScreenHeader } from '../../src/components/ui';
import { Logo } from '../../src/components/Logo';
import { FadeIn } from '../../src/components/motion';
import { Board } from '../../src/components/boards';
import { colors, spacing, typography } from '../../src/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const { data, isLoading, mutate, isValidating } = useSWR<any>('/dashboard', fetcher);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => mutate()} />
        }
      >
        <ScreenHeader
          title={`Bonjour ${user?.firstName ?? ''}`}
          subtitle={[
            user ? ROLE_LABEL[user.role] : '',
            user?.orphanage?.name,
            user?.province?.nameFr,
          ].filter(Boolean).join(' · ')}
          right={<Logo size={30} showText={false} />}
        />

        {isLoading || !data ? <Loading /> : <FadeIn style={s.boardWrap}><Board data={data} /></FadeIn>}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  scroll: { paddingBottom: spacing['4xl'] },
  boardWrap: { paddingHorizontal: spacing.lg, gap: spacing.md },
  greeting: { ...typography.display, color: colors.ink[950] },
  role: { ...typography.small, color: colors.ink[500], marginTop: 4 },
});
