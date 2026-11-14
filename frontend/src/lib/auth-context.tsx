'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, clearTokens, getToken, setTokens } from './api';
import type { Role } from './roles';
import { unregisterWebPush } from './push';

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
  /** Dispense d acces : le compte n est pas bloque par les notifications. */
  pushExempt?: boolean;
  organizationName?: string | null;
  country?: { id: string; iso2: string; nameFr: string; currency: string } | null;
  province?: { id: string; code: string; nameFr: string } | null;
  orphanage?: { id: string; name: string; slug: string; labelStatus: string } | null;
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    totp?: string,
    adminKey?: string,
  ) => Promise<{ twoFactorRequired?: boolean; adminKeyRequired?: boolean; user?: Me }>;
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
  const router = useRouter();

  async function loadMe() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    // Seul un refus d'authentification (401/403) met fin à la session. Une coupure
    // réseau ou un redémarrage de l'API ne doit pas déconnecter : on réessaie.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const me = await api.get<Me>('/auth/me');
        setUser(me);
        setLoading(false);
        return;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearTokens();
          setUser(null);
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    setUser(null);
    setLoading(false);
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function login(email: string, password: string, totp?: string, adminKey?: string) {
    const res = await api.post<any>('/auth/login', {
      email,
      password,
      ...(totp ? { totp } : {}),
      ...(adminKey ? { adminKey } : {}),
    });
    if (res.adminKeyRequired) return { adminKeyRequired: true };
    if (res.twoFactorRequired) return { twoFactorRequired: true };
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return { user: res.user as Me };
  }

  async function logout() {
    // Avant d'invalider le jeton : l'appareil ne doit plus recevoir ses alertes.
    await unregisterWebPush();
    try {
      await api.post('/auth/logout', {});
    } catch {
      /* le jeton peut deja etre invalide */
    }
    clearTokens();
    setUser(null);
    router.push('/connexion');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
