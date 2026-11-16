import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSWR from 'swr';
import { fetcher } from '../../src/lib/api';
import { ROLE_LABEL, useAuth } from '../../src/lib/auth';
import { Avatar, Hero, Loading } from '../../src/components/ui';
import { FadeIn } from '../../src/components/motion';
import { Board } from '../../src/components/boards';
import { TransitionBanner } from '../../src/components/TransitionBanner';
import { colors, spacing, typography } from '../../src/theme';
import { t, geoName, intlLocale } from '../../src/lib/i18n';

/** « lundi 16 novembre » → « Lundi 16 novembre » (seule la première lettre). */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function HomeScreen() {
  const { user } = useAuth();
  const { data, isLoading, mutate, isValidating } = useSWR<any>('/dashboard', fetcher);

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => mutate()} />
        }
      >
        <Hero
          meta={capitalize(new Date().toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }))}
          title={t("Bonjour {v0}", { v0: user?.firstName ?? '' })}
          subtitle={[
            user ? ROLE_LABEL[user.role] : '',
            user?.orphanage?.name,
            geoName(user?.province),
          ].filter(Boolean).join(' · ')}
          right={<Avatar uri={user?.avatarUrl} firstName={user?.firstName} lastName={user?.lastName} size={52} />}
        />

        <View style={s.boardWrap}>
          <TransitionBanner />
        </View>

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
