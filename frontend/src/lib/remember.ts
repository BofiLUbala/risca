import { canAccessPath } from './nav';
import type { Role } from './roles';

/**
 * « Se souvenir de moi » et reprise de la dernière page.
 *
 * - On retient l'ADRESSE E-MAIL, jamais le mot de passe : un mot de passe enregistré en clair dans le
 *   navigateur serait lisible par n'importe quel script de la page. Le gestionnaire de mots de passe du
 *   navigateur (formulaire avec autocomplete) s'en charge, de façon chiffrée.
 * - La session reste ouverte tant que le jeton de rafraîchissement est valable ; on retient en plus
 *   la dernière page visitée, pour y revenir à la reconnexion ou à la réouverture du site.
 */

const EMAIL_KEY = 'risac.rememberedEmail';
const LAST_KEY = 'risac.lastPath';
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* navigation privée ou stockage plein : la fonction reste facultative */
  }
}

export const getRememberedEmail = () => read(EMAIL_KEY) ?? '';
export const setRememberedEmail = (email: string | null) => write(EMAIL_KEY, email);

/** Pages où l'on ne revient jamais (accès, déconnexion). */
const SKIP = /^\/(connexion|inscription|activate|admin)(\/|$)/;

export function saveLastPath(userId: string, path: string) {
  if (SKIP.test(path)) return;
  write(LAST_KEY, JSON.stringify({ u: userId, p: path, t: Date.now() }));
}

/** Dernière page de CET utilisateur, si elle est récente et encore autorisée pour son rôle. */
export function lastPathFor(userId: string, role: Role): string | null {
  const raw = read(LAST_KEY);
  if (!raw) return null;
  try {
    const { u, p, t } = JSON.parse(raw) as { u: string; p: string; t: number };
    if (u !== userId || typeof p !== 'string' || !p.startsWith('/') || SKIP.test(p)) return null;
    if (Date.now() - t > MAX_AGE_MS) return null;
    if (!canAccessPath(role, p.split('?')[0])) return null;
    return p;
  } catch {
    return null;
  }
}

/** Où envoyer l'utilisateur une fois connecté. */
export function postLoginPath(user: { id: string; role: Role }): string {
  return lastPathFor(user.id, user.role) ?? '/tableau-de-bord';
}
