import { store } from './api';

/**
 * « Se souvenir de moi » et reprise de la dernière page, dans le stockage sécurisé de l'appareil.
 * On retient l'ADRESSE E-MAIL, jamais le mot de passe : l'appareil propose lui-même de mémoriser le mot de
 * passe de façon chiffrée (gestionnaire de mots de passe d'Android), sans qu'il passe par l'application.
 */

const EMAIL_KEY = 'risac_remember_email';
const LAST_KEY = 'risac_last_route';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

export async function getRememberedEmail(): Promise<string> {
  return (await store.get(EMAIL_KEY)) ?? '';
}

export async function setRememberedEmail(email: string | null): Promise<void> {
  if (email) await store.set(EMAIL_KEY, email);
  else await store.del(EMAIL_KEY);
}

const KEY_KEY = 'risac_admin_key';

/** Clé administrateur d'un Super Admin, mémorisée (à sa demande) dans le stockage chiffré de l'appareil. */
export async function getRememberedAdminKey(): Promise<string> {
  return (await store.get(KEY_KEY)) ?? '';
}

export async function setRememberedAdminKey(key: string | null): Promise<void> {
  if (key) await store.set(KEY_KEY, key);
  else await store.del(KEY_KEY);
}

/** Écrans où l'on ne revient jamais (accès). */
const SKIP = /^\/(connexion)(\/|$)/;

export async function saveLastRoute(userId: string, path: string): Promise<void> {
  if (SKIP.test(path)) return;
  await store.set(LAST_KEY, JSON.stringify({ u: userId, p: path, t: Date.now() }));
}

/** Dernier écran de CET utilisateur, s'il est récent. */
export async function lastRouteFor(userId: string): Promise<string | null> {
  const raw = await store.get(LAST_KEY);
  if (!raw) return null;
  try {
    const { u, p, t } = JSON.parse(raw) as { u: string; p: string; t: number };
    if (u !== userId || typeof p !== 'string' || !p.startsWith('/') || SKIP.test(p)) return null;
    if (Date.now() - t > MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}
