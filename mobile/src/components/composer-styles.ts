import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export const composerStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.ink[200],
    padding: spacing.md,
  },
  triggerText: { ...typography.small, color: colors.ink[400], flex: 1 },
  triggerBtn: {
    backgroundColor: colors.risac[50],
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.md,
  },
  triggerBtnText: { ...typography.caption, color: colors.risac[700] },

  modal: { flex: 1, backgroundColor: colors.white },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[100],
  },
  modalTitle: { ...typography.heading, color: colors.ink[900] },
  modalBody: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.ink[100],
  },
  chipActive: { backgroundColor: colors.risac[600] },
  chipText: { ...typography.caption, color: colors.ink[600] },
  chipTextActive: { color: colors.white },

  textarea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.ink[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    color: colors.ink[900],
    textAlignVertical: 'top',
  },

  warn: { backgroundColor: colors.amberSoft, borderRadius: radius.lg, padding: spacing.md },
  warnTitle: { ...typography.bodyMedium, color: colors.amberText },
  warnText: { ...typography.caption, color: colors.amberText, marginTop: 4 },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.ink[100] },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
  },

  error: {
    ...typography.small,
    color: colors.coralText,
    backgroundColor: colors.coralSoft,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  hint: { ...typography.caption, color: colors.ink[400], lineHeight: 17 },
});
