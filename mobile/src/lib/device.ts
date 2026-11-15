import * as Device from 'expo-device';
import Constants from 'expo-constants';

/**
 * Appareil réel, envoyé à la connexion pour la page « Sécurité des accès » du Super Admin
 * (par exemple « Samsung SM-S911B · Android 14 · Application RISAC »).
 * Les valeurs sont encodées : un nom d'appareil peut contenir des accents.
 */
export function deviceHeaders(): Record<string, string> {
  const values: Record<string, string | null | undefined> = {
    'X-Client-App': 'mobile',
    'X-Device-Brand': Device.brand ?? Device.manufacturer,
    'X-Device-Model': Device.modelName ?? Device.deviceName,
    'X-Device-Os': Device.osName,
    'X-Device-Os-Version': Device.osVersion,
    'X-App-Version': Constants.expoConfig?.version,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (v) out[k] = encodeURIComponent(String(v).slice(0, 48));
  return out;
}
