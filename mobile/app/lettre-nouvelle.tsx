import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { api, fetcher } from '../src/lib/api';
import { ROLE_LABEL, type Role } from '../src/lib/auth';
import { Button, Card, ScreenHeader } from '../src/components/ui';
import { BackIcon } from '../src/components/icons';
import { notify } from '../src/lib/dialog';
import { colors, radius, spacing, typography } from '../src/theme';
import { t } from '../src/lib/i18n';

/** Promotions possibles (miroir de backend/src/common/promotion-paths.ts). */
const PATHS: Partial<Record<Role, Role[]>> = {
  FIELD_AGENT: ['AMBASSADOR', 'REGIONAL_MANAGER'],
  AMBASSADOR: ['REGIONAL_MANAGER'],
};

/** Écrire la lettre au Super Admin n°1 : agent à promouvoir, rôle demandé, objet et motif. */
export default function LettreNouvelleScreen() {
  const router = useRouter();
  const { data: people } = useSWR<any[]>('/users', fetcher);
  const candidates = useMemo(() => (people ?? []).filter((p) => p.status === 'ACTIVE' && PATHS[p.role as Role]), [people]);

  const [candidateId, setCandidateId] = useState('');
  const [requestedRole, setRequestedRole] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidate = candidates.find((c) => c.id === candidateId);
  const roles = candidate ? (PATHS[candidate.role as Role] ?? []) : [];

  async function submit() {
    setError(null);
    if (!candidateId || !requestedRole) return setError(t("Choisissez l’agent et le rôle demandé."));
    if (!subject.trim()) return setError(t("Donnez un objet à la lettre."));
    if (body.trim().length < 30) return setError(t("Expliquez le motif dans la lettre (30 caractères au moins)."));
    setBusy(true);
    try {
      await api.post('/promotions/letters', { candidateId, requestedRole, subject: subject.trim(), body: body.trim() });
      notify(t("Lettre envoyée"), t("Elle est arrivée chez le Super Admin n°1."));
      router.replace('/lettres' as never);
    } catch (e: any) {
      setError(e?.message ?? t("Envoi impossible"));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("Retour")} style={s.back} hitSlop={8}>
            <BackIcon color={colors.ink[700]} />
            <Text style={s.backText}>{t("Retour")}</Text>
          </Pressable>
          <ScreenHeader title={t("Lettre au Super Admin")} subtitle={t("Elle part chez le Super Admin n°1, qui la tranche ou la transmet.")} />

          <Card style={{ gap: spacing.md }}>
            {error ? (
              <View style={s.error} accessibilityRole="alert">
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={s.field}>
              <Text style={s.label}>{t("Agent à promouvoir *")}</Text>
              {!candidates.length ? <Text style={s.muted}>{t("Aucun agent ni ambassadeur actif dans votre région.")}</Text> : null}
              <View style={s.chips}>
                {candidates.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setCandidateId(c.id);
                      setRequestedRole('');
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: candidateId === c.id }}
                    style={[s.chip, candidateId === c.id && s.chipOn]}
                  >
                    <Text style={[s.chipText, candidateId === c.id && s.chipTextOn]}>
                      {c.firstName} {c.lastName} · {ROLE_LABEL[c.role as Role]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {candidate ? (
              <View style={s.field}>
                <Text style={s.label}>{t("Rôle demandé *")}</Text>
                <View style={s.chips}>
                  {roles.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setRequestedRole(r)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: requestedRole === r }}
                      style={[s.chip, requestedRole === r && s.chipOn]}
                    >
                      <Text style={[s.chipText, requestedRole === r && s.chipTextOn]}>{ROLE_LABEL[r]}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={s.field}>
              <Text style={s.label}>{t("Objet *")}</Text>
              <TextInput value={subject} onChangeText={setSubject} maxLength={120} accessibilityLabel={t("Objet")} style={s.input} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>{t("Votre lettre *")}</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
                accessibilityLabel={t("Votre lettre")}
                placeholder={t("Présentez le parcours de l’agent et expliquez pourquoi il mérite cette promotion.")}
                placeholderTextColor={colors.ink[400]}
                style={[s.input, { minHeight: 150 }]}
              />
            </View>

            <Button title={t("Envoyer la lettre")} onPress={submit} loading={busy} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink[50] },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  backText: { ...typography.small, color: colors.ink[700] },
  field: { gap: 6 },
  label: { ...typography.small, fontWeight: '500', color: colors.ink[700] },
  muted: { ...typography.small, color: colors.ink[500] },
  input: { borderWidth: 1, borderColor: colors.ink[200], borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 15, color: colors.ink[900], backgroundColor: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.ink[200], borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.risac[700], borderColor: colors.risac[700] },
  chipText: { ...typography.small, color: colors.ink[700] },
  chipTextOn: { color: colors.white },
  error: { backgroundColor: colors.coralSoft, borderRadius: radius.lg, padding: spacing.md },
  errorText: { ...typography.small, color: colors.coralText },
});
