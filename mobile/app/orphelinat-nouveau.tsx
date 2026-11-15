import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useSWR from 'swr';
import { api, fetcher } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { Button, Card, ScreenHeader } from '../src/components/ui';
import { BackIcon } from '../src/components/icons';
import { notify } from '../src/lib/dialog';
import { colors, radius, spacing, typography } from '../src/theme';

/**
 * Enregistrer un orphelinat. Le pays et la région sont ceux de l'auteur : un agent de terrain ou un chef régional
 * enregistre dans sa région, un responsable national choisit la province de son pays. La structure part en
 * vérification (chef régional puis Super Admin).
 */
export default function NouvelOrphelinatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isNational = user?.role === 'NATIONAL_MANAGER';
  const countryId = user?.country?.id ?? '';
  const { data: provinces } = useSWR<any[]>(isNational && countryId ? `/geo/countries/${countryId}/provinces` : null, fetcher);

  const [provinceId, setProvinceId] = useState('');
  const [form, setForm] = useState({ name: '', city: '', commune: '', address: '', totalPlaces: '', occupiedPlaces: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const province = isNational ? provinceId : (user?.province?.id ?? '');

  async function submit() {
    setError(null);
    if (form.name.trim().length < 3) return setError('Donnez le nom de la structure (3 lettres au moins).');
    if (!countryId || !province) return setError(isNational ? 'Choisissez la province.' : 'Votre région n’est pas renseignée sur votre profil.');
    setBusy(true);
    try {
      await api.post('/orphanages', {
        name: form.name.trim(),
        countryId,
        provinceId: province,
        city: form.city.trim() || undefined,
        commune: form.commune.trim() || undefined,
        address: form.address.trim() || undefined,
        totalPlaces: form.totalPlaces ? Number(form.totalPlaces) : undefined,
        occupiedPlaces: form.occupiedPlaces ? Number(form.occupiedPlaces) : undefined,
      });
      notify('Orphelinat enregistré', 'Il part en vérification : le chef régional, puis le Super Admin.');
      router.replace('/orphelinats' as never);
    } catch (e: any) {
      setError(e?.message ?? 'Enregistrement impossible');
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, extra: object = {}) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => setForm({ ...form, [key]: v })}
        accessibilityLabel={label}
        placeholderTextColor={colors.ink[400]}
        style={s.input}
        {...extra}
      />
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={s.back} hitSlop={8}>
            <BackIcon color={colors.ink[700]} />
            <Text style={s.backText}>Retour</Text>
          </Pressable>
          <ScreenHeader title="Enregistrer un orphelinat" subtitle="La structure est vérifiée par le chef régional puis validée par le Super Admin." />

          <Card style={{ gap: spacing.md }}>
            {error ? (
              <View style={s.error} accessibilityRole="alert">
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {field('name', 'Nom de la structure *')}

            <View style={s.field}>
              <Text style={s.label}>Pays</Text>
              <Text style={s.fixed}>{user?.country?.nameFr ?? '—'}</Text>
            </View>

            {isNational ? (
              <View style={s.field}>
                <Text style={s.label}>Province *</Text>
                <View style={s.chips}>
                  {(provinces ?? []).map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setProvinceId(p.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: provinceId === p.id }}
                      style={[s.chip, provinceId === p.id && s.chipOn]}
                    >
                      <Text style={[s.chipText, provinceId === p.id && s.chipTextOn]}>{p.nameFr}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={s.field}>
                <Text style={s.label}>Région</Text>
                <Text style={s.fixed}>{user?.province?.nameFr ?? '—'}</Text>
              </View>
            )}

            {field('city', 'Ville')}
            {field('commune', 'Commune')}
            {field('address', 'Adresse')}
            {field('totalPlaces', 'Places au total', { keyboardType: 'number-pad' })}
            {field('occupiedPlaces', 'Places occupées', { keyboardType: 'number-pad' })}

            <Button title="Enregistrer" onPress={submit} loading={busy} />
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
  fixed: { ...typography.body, color: colors.ink[800], backgroundColor: colors.ink[50], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.ink[200], paddingHorizontal: spacing.md, paddingVertical: 13 },
  input: { borderWidth: 1, borderColor: colors.ink[200], borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 15, color: colors.ink[900], backgroundColor: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.ink[200], borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.risac[700], borderColor: colors.risac[700] },
  chipText: { ...typography.small, color: colors.ink[700] },
  chipTextOn: { color: colors.white },
  error: { backgroundColor: colors.coralSoft, borderRadius: radius.lg, padding: spacing.md },
  errorText: { ...typography.small, color: colors.coralText },
});
