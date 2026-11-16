import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Locale, LOCALES, t, useI18n } from '../lib/i18n';
import { colors } from '../theme';

/** Sélecteur de langue FR / EN : gardé sur l'appareil, français par défaut. `dark` pour un fond bleu marine. */
export function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale } = useI18n();
  return (
    <View style={[s.wrap, dark && s.wrapDark]} accessibilityRole="radiogroup" accessibilityLabel={t('Langue de l’interface')}>
      {LOCALES.map((l: Locale) => {
        const on = l === locale;
        return (
          <Pressable
            key={l}
            onPress={() => !on && setLocale(l)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={l === 'fr' ? 'Français' : 'English'}
            hitSlop={6}
            style={[s.opt, on && (dark ? s.optOnDark : s.optOn)]}
          >
            <Text style={[s.txt, dark && s.txtDark, on && (dark ? s.txtOnDark : s.txtOn)]}>{l.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.ink[100],
    borderWidth: 1,
    borderColor: colors.ink[200],
  },
  wrapDark: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.18)' },
  opt: { minWidth: 38, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  optOn: { backgroundColor: colors.risac[800] },
  optOnDark: { backgroundColor: colors.sun[400] },
  txt: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: colors.ink[500] },
  txtDark: { color: colors.risac[100] },
  txtOn: { color: colors.white },
  txtOnDark: { color: colors.navy },
});
