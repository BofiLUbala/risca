import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { Button } from '../../src/components/ui';
import { Logo } from '../../src/components/Logo';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await login(email.trim(), password, needsTotp ? totp : undefined);
      if (res.adminKeyRequired) {
        setError('Compte Super Admin : connectez-vous depuis le site web, page /admin, avec votre clé administrateur.');
        setBusy(false);
        return;
      }
      if (res.twoFactorRequired) {
        setNeedsTotp(true);
        setBusy(false);
        return;
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message ?? 'Connexion impossible');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Logo size={56} />

          <Text style={s.title}>Se connecter</Text>
          <Text style={s.subtitle}>
            Accédez à votre espace selon votre rôle dans le réseau RISAC.
          </Text>

          {error ? (
            <View style={s.error} accessibilityRole="alert">
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={s.field}>
            <Text style={s.label}>Adresse e-mail</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.org"
              placeholderTextColor={colors.ink[400]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={s.input}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Mot de passe</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="........"
              placeholderTextColor={colors.ink[400]}
              secureTextEntry
              autoComplete="current-password"
              style={s.input}
            />
          </View>

          {needsTotp ? (
            <View style={s.field}>
              <Text style={s.label}>Code de double authentification</Text>
              <TextInput
                value={totp}
                onChangeText={(v) => setTotp(v.replace(/\D/g, ''))}
                placeholder="000000"
                placeholderTextColor={colors.ink[400]}
                keyboardType="number-pad"
                maxLength={6}
                style={[s.input, s.otp]}
              />
            </View>
          ) : null}

          <Button
            title={needsTotp ? 'Valider le code' : 'Se connecter'}
            onPress={submit}
            loading={busy}
            style={{ marginTop: spacing.sm }}
          />

          <Text style={s.hint}>
            Les comptes du réseau sont créés par invitation. Les bailleurs peuvent s’inscrire depuis
            le site web.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: spacing.xl, paddingTop: spacing['3xl'], gap: spacing.md },
  title: { ...typography.display, color: colors.ink[950], marginTop: spacing['2xl'] },
  subtitle: { ...typography.body, color: colors.ink[500], marginBottom: spacing.lg },
  field: { gap: 6 },
  label: { ...typography.small, fontWeight: '500', color: colors.ink[700] },
  input: {
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink[900],
    backgroundColor: colors.white,
  },
  otp: { textAlign: 'center', letterSpacing: 8, fontSize: 18 },
  error: { backgroundColor: colors.coralSoft, borderRadius: radius.lg, padding: spacing.md },
  errorText: { ...typography.small, color: colors.coralText },
  hint: { ...typography.small, color: colors.ink[400], marginTop: spacing.md, lineHeight: 19 },
});
