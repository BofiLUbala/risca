import { ReactNode } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { colors, radius, shadow, spacing, statusTone, typography } from '../theme';
import { initials, label } from '../lib/format';
import { mediaUrl } from '../lib/api';
import { TabIcon } from './TabIcon';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Badge({ status, text, tone }: { status?: string; text?: string; tone?: { bg: string; fg: string } }) {
  const t = tone ?? statusTone(status);
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.fg }]}>{text ?? label(status)}</Text>
    </View>
  );
}

export function Avatar({
  uri, firstName, lastName, size = 44,
}: { uri?: string | null; firstName?: string; lastName?: string; size?: number }) {
  const src = mediaUrl(uri);
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={[s.avatarText, { fontSize: size * 0.36 }]}>{initials(firstName, lastName)}</Text>
      )}
    </View>
  );
}

export function Button({
  title, onPress, variant = 'primary', disabled, loading, icon, style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'soft' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}) {
  const v = s[`btn_${variant}`] as ViewStyle;
  const t = s[`btnText_${variant}`];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [s.btn, v, (disabled || loading) && s.btnDisabled, pressed && s.btnPressed, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? colors.navy : variant === 'danger' ? colors.white : colors.risac[700]} />
      ) : (
        icon
      )}
      <Text style={[s.btnText, t]}>{title}</Text>
    </Pressable>
  );
}

/** Teintes d'accent des indicateurs : fond de la pastille et couleur de l'icône. */
const STAT_TONES = {
  navy: { bg: colors.risac[50], fg: colors.risac[700] },
  sun: { bg: '#fdf3d3', fg: '#8a5d0a' },
  mint: { bg: colors.mintSoft, fg: colors.mintText },
  coral: { bg: colors.coralSoft, fg: colors.coralText },
  violet: { bg: colors.violetSoft, fg: colors.violet },
};
export type StatTone = keyof typeof STAT_TONES;

/**
 * Indicateur chiffré : libellé, pastille d'icône colorée, valeur sur une seule ligne
 * (la police se réduit plutôt que de couper un montant en deux).
 */
export function Stat({
  label: lbl, value, hint, icon, tone = 'navy',
}: { label: string; value: string; hint?: string; icon?: string; tone?: StatTone }) {
  const c = STAT_TONES[tone];
  return (
    <Card style={s.stat}>
      <View style={s.statTop}>
        <Text style={s.statLabel} numberOfLines={2}>{lbl}</Text>
        {icon ? (
          <View style={[s.statIcon, { backgroundColor: c.bg }]}>
            <TabIcon name={icon} color={c.fg} size={18} />
          </View>
        ) : null}
      </View>
      <Text
        style={[s.statValue, value.length > 11 ? { fontSize: 18 } : value.length > 8 ? { fontSize: 22 } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {value}
      </Text>
      {hint ? <Text style={s.statHint} numberOfLines={2}>{hint}</Text> : null}
      <View style={[s.statAccent, { backgroundColor: c.fg }]} />
    </Card>
  );
}

/**
 * En-tête de l'accueil : bandeau bleu marine avec la salutation, le rôle, la date et un accent doré.
 * Les cercles décoratifs reprennent les couleurs du logo sans gêner la lecture.
 */
export function Hero({ title, subtitle, meta, right }: { title: string; subtitle?: string; meta?: string; right?: ReactNode }) {
  return (
    <View style={s.hero}>
      <View style={[s.heroCircle, { width: 180, height: 180, right: -50, top: -70, backgroundColor: 'rgba(231,185,44,0.18)' }]} />
      <View style={[s.heroCircle, { width: 120, height: 120, right: 40, bottom: -70, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
      <View style={s.heroRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {meta ? <Text style={s.heroMeta}>{meta}</Text> : null}
          <Text style={s.heroTitle} accessibilityRole="header" numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={s.heroSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View style={s.heroBar} />
    </View>
  );
}

export function Empty({ title, description }: { title: string; description?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {description ? <Text style={s.emptyText}>{description}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.risac[500]} />
    </View>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${pct}%` }]} />
    </View>
  );
}

export function Row({ label: lbl, value }: { label: string; value?: ReactNode }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{lbl}</Text>
      <Text style={s.rowValue}>{value ?? '-'}</Text>
    </View>
  );
}

/**
 * Titre d'écran commun à tous les onglets : un petit repère jaune, le titre, une ligne de contexte.
 * `right` accueille un élément à droite (l'emblème sur l'accueil).
 */
export function ScreenHeader({
  title, subtitle, right,
}: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <View style={s.headerBar} />
        <Text style={s.headerTitle} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={s.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={s.sectionTitleText}>{children}</Text>
      {action}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.ink[200],
    padding: spacing.lg,
    ...shadow.soft,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: { ...typography.caption },
  avatar: {
    backgroundColor: colors.risac[300],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: colors.white, fontWeight: '600' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: radius.lg,
  },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  btnDisabled: { opacity: 0.5 },
  btn_primary: { backgroundColor: colors.sun[400] },
  btn_outline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ink[300] },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_soft: { backgroundColor: colors.risac[50] },
  btn_danger: { backgroundColor: colors.coral },
  btnText: { ...typography.bodyMedium },
  btnText_primary: { color: colors.navy },
  btnText_outline: { color: colors.ink[700] },
  btnText_ghost: { color: colors.ink[600] },
  btnText_soft: { color: colors.risac[800] },
  btnText_danger: { color: colors.white },
  stat: { flex: 1, minWidth: 140, overflow: 'hidden', paddingBottom: spacing.lg + 2 },
  statTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 34 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statAccent: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, opacity: 0.85 },
  statLabel: { ...typography.small, color: colors.ink[500], flex: 1 },
  statValue: { ...typography.display, color: colors.ink[950], marginTop: 8, fontVariant: ['tabular-nums'] },
  statHint: { ...typography.caption, color: colors.ink[500], marginTop: 3 },
  hero: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius['2xl'],
    backgroundColor: colors.risac[800],
    overflow: 'hidden',
    ...shadow.lift,
  },
  heroCircle: { position: 'absolute', borderRadius: 999 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroMeta: { fontSize: 12, fontWeight: '600', color: colors.sun[300], letterSpacing: 0.4, marginBottom: 6 },
  heroTitle: { fontSize: 26, fontWeight: '700', color: colors.white, letterSpacing: -0.4 },
  heroSubtitle: { fontSize: 14, color: colors.risac[100], marginTop: 4 },
  heroBar: { width: 44, height: 4, borderRadius: radius.full, backgroundColor: colors.sun[400], marginTop: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerBar: { width: 28, height: 4, borderRadius: radius.full, backgroundColor: colors.sun[400], marginBottom: 8 },
  headerTitle: { ...typography.display, color: colors.ink[950] },
  headerSubtitle: { ...typography.small, color: colors.ink[500], marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing['4xl'], paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.heading, color: colors.ink[800], textAlign: 'center' },
  emptyText: { ...typography.small, color: colors.ink[500], textAlign: 'center', marginTop: 6 },
  loading: { paddingVertical: spacing['4xl'], alignItems: 'center' },
  track: { height: 8, borderRadius: radius.full, backgroundColor: colors.ink[100], overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.risac[500] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[100],
  },
  rowLabel: { ...typography.small, color: colors.ink[500], flex: 1 },
  rowValue: { ...typography.bodyMedium, color: colors.ink[900] },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleText: { ...typography.heading, color: colors.ink[900] },
});
