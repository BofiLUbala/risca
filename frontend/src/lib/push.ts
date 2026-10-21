'use client';

import { api } from './api';

/**
 * Notifications push du web, par Firebase Cloud Messaging.
 *
 * Tout est facultatif : sans configuration Firebase, sans navigateur compatible
 * ou si la personne refuse l'autorisation, l'application continue normalement et
 * la cloche de notifications reste la source de vérité.
 *
 * Variables attendues dans `.env.local` :
 * `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
 * `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
 * et `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
 */

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** Clé locale : le jeton envoyé au serveur, pour pouvoir le retirer à la déconnexion. */
const TOKEN_KEY = 'risac_push_token';

export function isPushConfigured(): boolean {
  return Boolean(CONFIG.apiKey && CONFIG.projectId && CONFIG.messagingSenderId && CONFIG.appId && VAPID_KEY);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/** État affichable dans le profil, sans rien demander à la personne. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Demande l'autorisation si besoin, récupère le jeton Firebase et l'enregistre
 * auprès de l'API. Renvoie `false` sans rien casser si ce n'est pas possible.
 *
 * `askPermission` à `false` n'affiche aucune fenêtre : utilisé au démarrage pour
 * ne réenregistrer que les personnes ayant déjà accepté.
 */
export async function registerWebPush(askPermission = false): Promise<boolean> {
  if (!isPushConfigured() || !isPushSupported()) return false;

  try {
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      if (!askPermission) return false;
      const granted = await Notification.requestPermission();
      if (granted !== 'granted') return false;
    }

    // Chargé seulement ici : le SDK Firebase ne pèse sur aucune page sans push.
    const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);
    if (!(await isSupported())) return false;

    const app = getApps().length ? getApps()[0] : initializeApp(CONFIG as Record<string, string>);
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    // Un service worker ne lit pas les variables d'environnement : on la lui passe.
    await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'RISAC_FIREBASE_CONFIG', config: CONFIG });
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    await api.post('/notifications/devices', {
      token,
      platform: 'WEB',
      label: navigator.userAgent.slice(0, 80),
    });
    localStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    // Un push indisponible ne doit jamais empêcher de travailler.
    return false;
  }
}

/** Retire l'appareil à la déconnexion : la personne suivante ne reçoit pas ses alertes. */
export async function unregisterWebPush(): Promise<void> {
  const token = typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await api.del(`/notifications/devices/${encodeURIComponent(token)}`);
  } catch {
    /* le jeton sera de toute façon écarté par Firebase */
  }
  localStorage.removeItem(TOKEN_KEY);
}
