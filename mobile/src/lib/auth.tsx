import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { registerPush, unregisterPush } from './push';
import { api, clearTokens, getToken, setTokens } from './api';
import { closeSocket } from './socket';

export type Role =
  | 'SUPER_ADMIN' | 'ADMIN_FINANCE' | 'MODERATOR' | 'ETHICS_AUDITOR'
  | 'NATIONAL_MANAGER' | 'REGIONAL_MANAGER' | 'AMBASSADOR' | 'FIELD_AGENT'
  | 'ORPHANAGE_DIRECTOR' | 'ORPHANAGE_STAFF' | 'DONOR' | 'PARTNER';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_FINANCE: 'Admin Finance',
  MODERATOR: 'Moderateur',
  ETHICS_AUDITOR: 'Auditeur Éthique',
  NATIONAL_MANAGER: 'Responsable National',
  REGIONAL_MANAGER: 'Chef Régional',
  AMBASSADOR: 'Ambassadeur',
  FIELD_AGENT: 'Agent de terrain',
  ORPHANAGE_DIRECTOR: "Chef d'orphelinat",
  ORPHANAGE_STAFF: "Personnel de l'orphelinat",
  DONOR: 'Bailleur de fonds',
  PARTNER: 'Partenaire',
};

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: string;
  avatarUrl?: string | null;
  locale: string;
  staffFunction?: string | null;
  twoFactorEnabled: boolean;
  organizationName?: string | null;
  country?: { id: string; iso2: string; nameFr: string; currency: string } | null;
  province?: { id: string; code: string; nameFr: string } | null;
  orphanage?: { id: string; name: string; slug: string; labelStatus: string } | null;
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string, totp?: string) => Promise<{ twoFactorRequired?: boolean; adminKeyRequired?: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => ({}),
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api.get<Me>('/auth/me'));
      // Reenregistrement silencieux : aucune demande si la personne n a pas deja accepte.
      void registerPush(false);
    } catch {
      await clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function login(email: string, password: string, totp?: string) {
    const res = await api.post<any>('/auth/login', { email, password, ...(totp ? { totp } : {}) });
    if (res.adminKeyRequired) return { adminKeyRequired: true };
    if (res.twoFactorRequired) return { twoFactorRequired: true };
    closeSocket();
    await setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    // Premiere connexion sur cet appareil : c est le bon moment pour demander.
    void registerPush(true);
    return {};
  }

  async function logout() {
    // Avant d invalider le jeton : cet appareil ne doit plus recevoir ses alertes.
    await unregisterPush();
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* le jeton peut deja etre invalide */
    }
    // Le socket porte l'identite de la session qui se ferme : sans cette coupure il restait
    // abonne aux salons de la personne et servait la suivante a se connecter sur l'appareil.
    closeSocket();
    await clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
