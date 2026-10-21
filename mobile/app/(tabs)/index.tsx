import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSWR from 'swr';
import { fetcher } from '../../src/lib/api';
import { ROLE_LABEL, useAuth } from '../../src/lib/auth';
import { Loading } from '../../src/components/ui';
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
        <View>
          <Text style={s.greeting}>Bonjour {user?.firstName}</Text>
          <Text style={s.role}>
            {user ? ROLE_LABEL[user.role] : ''}
            {user?.orphanage ? ` - ${user.orphanage.name}` : ''}
            {user?.province ? ` - ${user.province.nameFr}` : ''}
          </Text>
        </View>

        {isLoading || !data ? <Loading /> : <Board data={data} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  greeting: { ...typography.display, color: colors.ink[950] },
  role: { ...typography.small, color: colors.ink[500], marginTop: 4 },
});
