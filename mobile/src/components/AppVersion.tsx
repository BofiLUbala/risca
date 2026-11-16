import { Platform, StyleSheet, Text } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { t } from '../lib/i18n';
import { date } from '../lib/format';
import { colors, typography } from '../theme';

/**
 * Version installée, en bas du profil : numéro de build du Play Store et mise à jour automatique en cours.
 * Sert à savoir d'un coup d'œil si un téléphone a reçu la dernière version
 * (un build 21 ou plus ancien ne reçoit pas les mises à jour automatiques : passer par le Play Store).
 * Lecture seule, sans module natif supplémentaire (la version d'exécution ne change pas).
 */
export function AppVersion() {
  const app = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '';
  const build = Constants.nativeBuildVersion;
  const web = Platform.OS === 'web';
  const update =
    !web && Updates.isEnabled && Updates.updateId && !Updates.isEmbeddedLaunch
      ? t('mise à jour {id} du {date}', { id: Updates.updateId.slice(0, 8), date: date(Updates.createdAt) })
      : t('version d’origine du build');

  return (
    <Text style={s.text} selectable accessibilityLabel={t('Version de l’application')}>
      {t('RISAC {app}', { app })}
      {build ? ` · ${t('build {build}', { build })}` : ''}
      {web ? '' : `\n${update}`}
    </Text>
  );
}

const s = StyleSheet.create({
  text: { ...typography.caption, color: colors.ink[400], textAlign: 'center', lineHeight: 17, marginTop: 4 },
});
