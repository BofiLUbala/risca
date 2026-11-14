import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Button } from '../../src/components/ui';
import { Logo } from '../../src/components/Logo';
import { askPushPermission, pushStatus } from '../../src/lib/push';
import { colors, radius, shadow, spacing, typography } from '../../src/theme';

/**
 * Première étape avant toute connexion ou création de compte : autoriser les notifications.
 * Une fois l'autorisation donnée, le jeton de l'appareil est rattaché au compte à la connexion.
 * Un refus définitif n'enferme personne : l'écran explique le réglage du téléphone et laisse continuer ;
 * dans Expo Go ou sans push disponible, rien n'est bloqué.
 */
export default function AuthLayout() {
  const [state, setState] = useState<'checking' | 'ask' | 'denied' | 'ready'>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushStatus().then((st) => setState(st === 'granted' || st === 'unavailable' ? 'ready' : st === 'denied' ? 'denied' : 'ask'));
  }, []);

  async function enable() {
    setBusy(true);
    const st = await askPushPermission();
    setBusy(false);
    setState(st === 'granted' || st === 'unavailable' ? 'ready' : 'denied');
  }

  if (state === 'ready') return <Stack id="auth" screenOptions={{ headerShown: false }} />;
  if (state === 'checking') return <View style={s.safe} />;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.card}>
        <View style={s.logo}>
          <Logo size={36} />
        </View>
        <Text style={s.title} accessibilityRole="header">Activez les notifications</Text>
        <Text style={s.text}>
          Première étape : autorisez les notifications. RISAC vous prévient dès qu’il y a du nouveau, même application fermée :
          publication, message, tâche à traiter, validation.
        </Text>
        {state === 'ask' ? (
          <Button title="Activer les notifications" onPress={enable} loading={busy} />
        ) : (
          <>
            <View style={s.warn}>
              <Text style={s.warnText}>
                Les notifications sont bloquées. Ouvrez les réglages du téléphone, rubrique Notifications de RISAC, puis autorisez-les.
              </Text>
            </View>
            <Button title="Ouvrir les réglages" onPress={() => void Linking.openSettings()} />
            <Button title="J’ai autorisé" variant="outline" onPress={enable} loading={busy} />
            <Button title="Continuer sans" variant="ghost" onPress={() => setState('ready')} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50], justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    borderTopWidth: 4,
    borderTopColor: colors.amber,
    borderWidth: 1,
    borderColor: colors.ink[200],
    padding: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    ...shadow.lift,
  },
  logo: { alignSelf: 'center' },
  title: { ...typography.title, fontSize: 22, color: colors.ink[950], textAlign: 'center' },
  text: { ...typography.small, color: colors.ink[600], textAlign: 'center', lineHeight: 20 },
  warn: { backgroundColor: colors.coralSoft, borderRadius: radius.lg, padding: spacing.md },
  warnText: { ...typography.small, color: colors.coralText },
});
