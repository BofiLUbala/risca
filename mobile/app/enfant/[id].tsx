import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import useSWR from 'swr';
import { api, fetcher, mediaUrl } from '../../src/lib/api';
import { Badge, Button, Card, Loading, Progress, SectionTitle } from '../../src/components/ui';
import { BackIcon } from '../../src/components/icons';
import { publicChildStyles as s } from '../../src/components/public-child-styles';
import { date, money } from '../../src/lib/format';
import { colors, spacing } from '../../src/theme';
import { t, geoName } from '../../src/lib/i18n';
import { Tr } from '../../src/lib/i18n/dynamic';

const PRESETS = [10, 25, 50, 100];

export default function PublicChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: child, isLoading } = useSWR<any>(id ? `/children/public/${id}` : null, fetcher);
  const { data: methods } = useSWR<any[]>('/payments/methods', fetcher);

  const [mode, setMode] = useState<'ONE_OFF' | 'SPONSORSHIP'>('ONE_OFF');
  const [amount, setAmount] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: feeQuote } = useSWR<any>(`/payments/quote?amount=${amount}&currency=USD`, fetcher);

  if (isLoading || !child) {
    return (
      <SafeAreaView style={s.safe}>
        <Loading />
      </SafeAreaView>
    );
  }

  const photo = mediaUrl(child.publicPhotoUrl);
  const provider = methods?.[0]?.provider ?? 'FLUTTERWAVE';

  /** Le paiement s ouvre sur une page web securisee, jamais en achat integre. */
  async function pay() {
    setBusy(true);
    setError(null);
    try {
      let url: string | null = null;
      if (mode === 'SPONSORSHIP') {
        const r = await api.post<any>('/payments/sponsorships', {
          childId: child.id,
          monthlyAmount: amount,
          currency: 'USD',
          scope: 'FULL',
          endRule: 'FIXED_MONTHS',
          months: 12,
          provider,
        });
        url = r.firstPayment?.checkout?.checkoutUrl ?? null;
      } else {
        const r = await api.post<any>('/payments/donations', {
          kind: 'ONE_OFF',
          amount,
          currency: 'USD',
          childId: child.id,
          provider,
        });
        url = r.checkout?.checkoutUrl ?? null;
      }
      if (url) await WebBrowser.openBrowserAsync(url);
    } catch (e: any) {
      setError(e?.message ?? t("Paiement impossible"));
    }
    setBusy(false);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <BackIcon color={colors.ink[700]} />
        </Pressable>
        <Text style={s.headerTitle}>{child.firstName}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.photoWrap}>
          {photo ? (
            <Image source={{ uri: photo }} style={s.photo} resizeMode="cover" />
          ) : (
            <Text style={s.initial}>{child.firstName[0]}</Text>
          )}
        </View>

        <View>
          <Text style={s.name}>
            {child.firstName}
            {child.age != null ? t(", {age} ans", { age: child.age }) : ''}
          </Text>
          <Text style={s.region}>
            {child.region} - {geoName(child.orphanage.country)}
          </Text>
          <View style={s.tags}>
            {child.warOrphan ? <Badge text={t("Orphelin de guerre")} status="PENDING" /> : null}
            {!child.hasSponsor ? <Badge text={t("Sans parrain")} status="NEEDS_CORRECTION" /> : null}
          </View>
        </View>

        {child.publicStory ? (
          <Card>
            <SectionTitle>{t("Son histoire")}</SectionTitle>
            <Text style={s.body}>{child.publicStory}</Text>
          </Card>
        ) : null}

        {child.projects?.length > 0 ? (
          <Card>
            <SectionTitle>{t("Projets en cours")}</SectionTitle>
            {child.projects.map((p: any) => (
              <View key={p.id} style={{ marginBottom: spacing.md }}>
                <Text style={s.projectTitle}><Tr text={p.title} /></Text>
                <View style={{ marginTop: 8 }}>
                  <Progress value={p.collectedAmount} total={p.targetAmount} />
                </View>
                <Text style={s.projectMeta}>
                  {money(p.collectedAmount, p.currency)}{' '}{t("sur")}{' '}{money(p.targetAmount, p.currency)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {child.timeline?.length > 0 ? (
          <Card>
            <SectionTitle>{t("Ses nouvelles")}</SectionTitle>
            {child.timeline.map((e: any) => (
              <View key={e.id} style={s.event}>
                <Text style={s.eventTitle}><Tr text={e.title} /></Text>
                {e.description ? <Text style={s.eventText}><Tr text={e.description} /></Text> : null}
                <Text style={s.eventMeta}>{date(e.occurredAt)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <SupportCard
          child={child}
          mode={mode}
          setMode={setMode}
          amount={amount}
          setAmount={setAmount}
          feeQuote={feeQuote}
          error={error}
          busy={busy}
          onPay={pay}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SupportCard({
  child, mode, setMode, amount, setAmount, feeQuote, error, busy, onPay,
}: {
  child: any;
  mode: 'ONE_OFF' | 'SPONSORSHIP';
  setMode: (m: 'ONE_OFF' | 'SPONSORSHIP') => void;
  amount: number;
  setAmount: (n: number) => void;
  feeQuote: any;
  error: string | null;
  busy: boolean;
  onPay: () => void;
}) {
  return (
    <Card>
      <SectionTitle>{t("Soutenir")}{' '}{child.firstName}</SectionTitle>

      {child.publicNeeds ? (
        <View style={s.need}>
          <Text style={s.needText}>{child.publicNeeds}</Text>
        </View>
      ) : null}

      <View style={s.modeRow}>
        <Pressable onPress={() => setMode('ONE_OFF')} style={[s.modeBtn, mode === 'ONE_OFF' && s.modeActive]}>
          <Text style={[s.modeText, mode === 'ONE_OFF' && s.modeTextActive]}>{t("Financer")}</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('SPONSORSHIP')}
          style={[s.modeBtn, mode === 'SPONSORSHIP' && s.modeActive]}
        >
          <Text style={[s.modeText, mode === 'SPONSORSHIP' && s.modeTextActive]}>{t("Parrainer")}</Text>
        </Pressable>
      </View>

      <View style={s.amountRow}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setAmount(p)}
            style={[s.amountBtn, amount === p && s.amountActive]}
          >
            <Text style={[s.amountText, amount === p && s.amountTextActive]}>{p} $</Text>
          </Pressable>
        ))}
      </View>

      {feeQuote ? (
        <View style={s.fees}>
          <Text style={s.feesTitle}>{t("Transparence des frais")}</Text>
          <Text style={s.feesLine}>
            {t("Versement")}{' '}{money(feeQuote.amount)}{' '}{t("- frais")}{' '}{money(feeQuote.feeAmount)} (
            {feeQuote.feePercent} %)
          </Text>
          <Text style={s.feesStrong}>{t("Montant affecte")}{' '}{money(feeQuote.netAmount)}</Text>
        </View>
      ) : null}

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Button
        title={mode === 'SPONSORSHIP' ? t("Parrainer {v0} / mois", { v0: money(amount) }) : t("Donner {v0}", { v0: money(amount) })}
        onPress={onPay}
        loading={busy}
        style={{ marginTop: spacing.md }}
      />

      <Text style={s.hint}>
        {t("Le paiement s’ouvre sur une page web sécurisée. Vous ecrivez à l’ambassadeur de l’enfant, jamais à l’enfant lui-même.")}
      </Text>
    </Card>
  );
}
