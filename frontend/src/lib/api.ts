'use client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4000';

const ACCESS = 'risac_access';
const REFRESH = 'risac_refresh';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS);
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS, access);
  if (refresh) localStorage.setItem(REFRESH, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(status: number, payload: any) {
    super(payload?.message ?? `Erreur ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = getToken();
  const res = await fetch(API_URL + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh(token);
    if (refreshed) return request<T>(path, init, false);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/**
 * Le jeton de rafraîchissement est à usage unique : deux rafraîchissements simultanés
 * (plusieurs requêtes d'un même onglet, ou plusieurs onglets) feraient échouer le second et
 * déconnecteraient l'utilisateur. On les met donc en file :
 *  - dans un onglet, toutes les requêtes en 401 partagent un seul rafraîchissement ;
 *  - entre onglets, un verrou du navigateur (Web Locks) les passe l'un après l'autre, et un onglet
 *    qui obtient le verrou après un autre constate que le jeton d'accès a déjà changé : il l'utilise.
 */
let inflight: Promise<boolean> | null = null;

function tryRefresh(staleAccess: string | null): Promise<boolean> {
  if (!inflight) {
    inflight = refreshOnce(staleAccess).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function refreshOnce(staleAccess: string | null): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    // Un autre onglet a déjà renouvelé la session pendant l'attente du verrou.
    const current = getToken();
    if (current && current !== staleAccess) return true;

    const refreshToken = localStorage.getItem(REFRESH);
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  };

  const locks = (navigator as Navigator & { locks?: { request: <T>(name: string, cb: () => Promise<T>) => Promise<T> } }).locks;
  return locks?.request ? locks.request('risac-refresh', run) : run();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const fetcher = <T>(path: string) => api.get<T>(path);

/** Televersement de fichier (hors JSON). */
export async function uploadFile(file: File): Promise<{ url: string; name: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json();
}

export function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return API_ORIGIN + url;
}
