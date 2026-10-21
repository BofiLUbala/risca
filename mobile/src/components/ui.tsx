import { ReactNode } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { colors, radius, shadow, spacing, statusTone, typography } from '../theme';
import { initials, label } from '../lib/format';
import { mediaUrl } from '../lib/api';

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
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? colors.white : colors.risac[700]} />
      ) : (
        icon
      )}
      <Text style={[s.btnText, t]}>{title}</Text>
    </Pressable>
  );
}

export function Stat({ label: lbl, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={s.stat}>
      <Text style={s.statLabel} numberOfLines={2}>{lbl}</Text>
      <Text style={s.statValue}>{value}</Text>
      {hint ? <Text style={s.statHint} numberOfLines={2}>{hint}</Text> : null}
    </Card>
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
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btn_primary: { backgroundColor: colors.risac[700] },
  btn_outline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ink[300] },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_soft: { backgroundColor: colors.risac[50] },
  btn_danger: { backgroundColor: colors.coral },
  btnText: { ...typography.bodyMedium },
  btnText_primary: { color: colors.white },
  btnText_outline: { color: colors.ink[700] },
  btnText_ghost: { color: colors.ink[600] },
  btnText_soft: { color: colors.risac[800] },
  btnText_danger: { color: colors.white },
  stat: { flex: 1, minWidth: 150 },
  statLabel: { ...typography.small, color: colors.ink[500] },
  statValue: { ...typography.title, color: colors.ink[900], marginTop: 6 },
  statHint: { ...typography.caption, color: colors.ink[400], marginTop: 3 },
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
