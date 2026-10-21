import { Alert, Platform } from 'react-native';

/**
 * Alert.alert ne fait rien sur react-native-web : sans ce relais, une confirmation (se
 * deconnecter) ne s'affichait jamais dans la version web de l'application. Sur mobile,
 * on garde les boites natives.
 */
const browser = globalThis as unknown as {
  alert?: (message: string) => void;
  confirm?: (message: string) => boolean;
};

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    browser.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(options: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (Platform.OS === 'web') {
    if (browser.confirm?.(`${options.title}\n\n${options.message}`)) options.onConfirm();
    return;
  }
  Alert.alert(options.title, options.message, [
    { text: 'Annuler', style: 'cancel' },
    { text: options.confirmLabel, style: options.destructive ? 'destructive' : 'default', onPress: options.onConfirm },
  ]);
}
