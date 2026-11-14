import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { Button } from '../../src/components/ui';
import { Logo } from '../../src/components/Logo';
import { CheckIcon, EyeIcon } from '../../src/components/icons';
import { getRememberedEmail, setRememberedEmail } from '../../src/lib/remember';
import { colors, radius, shadow, spacing, typography } from '../../src/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Adresse retenue lors d'une connexion précédente : la case est cochée et le champ prérempli.
  useEffect(() => {
    void getRememberedEmail().then((saved) => {
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    });
  }, []);

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
      await setRememberedEmail(remember ? email.trim() : null);
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
          {/* Une seule carte centrée, le logo centré en tête : même modèle que le site web. */}
          <View style={s.card}>
          <View style={s.logo}>
            <Logo size={36} />
          </View>

          <Text style={s.title} accessibilityRole="header">Se connecter</Text>
          <Text style={s.subtitle}>
            Accédez à votre espace selon votre rôle dans le réseau.
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
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Adresse e-mail"
              style={s.input}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Mot de passe</Text>
            <View style={s.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                accessibilityLabel="Mot de passe"
                style={[s.input, s.passwordInput]}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                hitSlop={8}
                style={s.eye}
              >
                <EyeIcon off={showPassword} color={colors.ink[500]} />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => setRemember((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            accessibilityLabel="Se souvenir de moi"
            style={s.remember}
          >
            <View style={[s.box, remember && s.boxOn]}>{remember ? <CheckIcon color={colors.white} /> : null}</View>
            <Text style={s.rememberText}>Se souvenir de moi</Text>
          </Pressable>

          {needsTotp ? (
            <View style={s.field}>
              <Text style={s.label}>Code de double authentification</Text>
              <TextInput
                value={totp}
                onChangeText={(v) => setTotp(v.replace(/\D/g, ''))}
                placeholder="000000"
                placeholderTextColor={colors.ink[400]}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                accessibilityLabel="Code de double authentification"
                maxLength={6}
                style={[s.input, s.otp]}
              />
            </View>
          ) : null}

          <Button
            title={needsTotp ? 'Valider le code' : 'Se connecter'}
            onPress={submit}
            loading={busy}
            style={{ marginTop: spacing.xs }}
          />

          <View style={s.divider} />
          <Text style={s.hint}>
            Les comptes du réseau sont créés par invitation. Les bailleurs s’inscrivent depuis le site
            web.
          </Text>
          </View>
          <Text style={s.footnote}>Réseau International des Structures d’Accueil du Congo</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
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
  logo: { alignSelf: 'center', marginBottom: spacing.xs },
  title: { ...typography.title, fontSize: 22, color: colors.ink[950], textAlign: 'center' },
  subtitle: { ...typography.small, color: colors.ink[500], textAlign: 'center', marginTop: -spacing.sm, marginBottom: spacing.xs },
  divider: { height: 1, backgroundColor: colors.ink[100], marginTop: spacing.xs },
  footnote: { ...typography.caption, fontWeight: '400', color: colors.ink[500], textAlign: 'center' },
  field: { gap: 6 },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  remember: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.ink[300], backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.risac[700], borderColor: colors.risac[700] },
  rememberText: { ...typography.small, color: colors.ink[700] },
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
  hint: { ...typography.small, color: colors.ink[500], textAlign: 'center', lineHeight: 19 },
});
