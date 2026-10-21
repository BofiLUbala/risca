import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from './api';

/**
 * Expo Go ne gere plus les notifications distantes depuis le SDK 53, et le
 * simple import du module y leve une erreur qui arrete toute l'application.
 * On ne le charge donc que dans une build de developpement ou de production.
 */
const dansExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type ModuleNotifications = typeof import('expo-notifications');
let moduleCharge: ModuleNotifications | null = null;
let handlerPose = false;

async function chargerNotifications(): Promise<ModuleNotifications | null> {
  if (dansExpoGo) return null;
  if (moduleCharge) return moduleCharge;
  try {
    moduleCharge = await import('expo-notifications');
  } catch {
    return null;
  }
  if (!handlerPose) {
    handlerPose = true;
    moduleCharge.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
  return moduleCharge;
}

/**
 * Notifications push de l'application mobile.
 *
 * Le jeton recupere est le jeton natif de l'appareil (FCM sur Android, APNs sur
 * iOS), envoye tel quel a l'API : le serveur parle directement a Firebase, sans
 * service de relais.
 *
 * A savoir : le push distant ne fonctionne pas dans Expo Go. Il faut un
 * development build ou une build EAS, avec `google-services.json` cote Android
 * et une cle APNs declaree dans Firebase cote iOS.
 */

/** Jeton transmis au serveur, conserve pour pouvoir le retirer a la deconnexion. */
let currentToken: string | null = null;

/**
 * Canaux Android : chaque categorie se coupe separement dans les reglages du
 * telephone, sans faire taire les alertes importantes.
 */
async function ensureAndroidChannels(N: ModuleNotifications) {
  if (Platform.OS !== 'android') return;
  const channels: Array<[string, string, number]> = [
    ['general', 'General', N.AndroidImportance.DEFAULT],
    ['validations', 'Validations', N.AndroidImportance.HIGH],
    ['argent', 'Dons et decaissements', N.AndroidImportance.HIGH],
    ['securite', 'Securite du compte', N.AndroidImportance.HIGH],
    ['moderation', 'Moderation', N.AndroidImportance.DEFAULT],
  ];
  for (const [id, name, importance] of channels) {
    await N.setNotificationChannelAsync(id, { name, importance });
  }
}

/**
 * Demande l'autorisation si besoin, puis enregistre l'appareil aupres de l'API.
 * Ne leve jamais : sans push, l'application reste parfaitement utilisable et la
 * liste des notifications fait foi.
 *
 * `askPermission` a `false` n'affiche aucune demande : au demarrage, on ne
 * reenregistre que les personnes ayant deja accepte.
 */
export async function registerPush(askPermission = false): Promise<boolean> {
  const N = await chargerNotifications();
  if (!N) return false;

  try {
    const existing = await N.getPermissionsAsync();
    let granted = existing.granted;

    if (!granted) {
      if (!askPermission || !existing.canAskAgain) return false;
      const asked = await N.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return false;

    await ensureAndroidChannels(N);

    // Jeton natif de l'appareil : FCM sur Android, APNs sur iOS.
    const device = await N.getDevicePushTokenAsync();
    const token = typeof device.data === 'string' ? device.data : String(device.data);
    if (!token) return false;

    await api.post('/notifications/devices', {
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      label: `${Platform.OS} ${Platform.Version}`,
    });
    currentToken = token;
    return true;
  } catch {
    // Emulateur sans Google Play, Expo Go, autorisation refusee : on continue.
    return false;
  }
}

/** Retire l'appareil : la personne suivante a se connecter ne recoit pas ses alertes. */
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  try {
    await api.del(`/notifications/devices/${encodeURIComponent(currentToken)}`);
  } catch {
    /* le jeton sera de toute facon ecarte par Firebase */
  }
  currentToken = null;
}

/** Etat affichable dans le profil, sans rien demander. */
export async function pushStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const N = await chargerNotifications();
  if (!N) return 'undetermined';
  try {
    const p = await N.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}
