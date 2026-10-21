import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; apiOrigin?: string };

/**
 * Sur un appareil physique, localhost designe le telephone.
 * On deduit l adresse de la machine de developpement depuis le hote Metro.
 */
function resolveHost(url: string): string {
  if (Platform.OS === 'web') return url;
  const debuggerHost = Constants.expoConfig?.hostUri ?? '';
  const host = debuggerHost.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return url.replace('localhost', host).replace('127.0.0.1', host);
  }
  if (Platform.OS === 'android') {
    return url.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
  }
  return url;
}

export const API_URL = resolveHost(extra.apiUrl ?? 'http://localhost:4000/api');
export const API_ORIGIN = resolveHost(extra.apiOrigin ?? 'http://localhost:4000');

const ACCESS = 'risac_access';
const REFRESH = 'risac_refresh';

/** SecureStore n existe pas sur le web : on retombe sur localStorage. */
const store = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async del(key: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await store.get(ACCESS);
  return cachedToken;
}

export async function setTokens(access: string, refresh?: string) {
  cachedToken = access;
  await store.set(ACCESS, access);
  if (refresh) await store.set(REFRESH, refresh);
}

export async function clearTokens() {
  cachedToken = null;
  await store.del(ACCESS);
  await store.del(REFRESH);
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

async function tryRefresh(): Promise<boolean> {
  const refreshToken = await store.get(REFRESH);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    await setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getToken();
  const res = await fetch(API_URL + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, init, false);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
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

export function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return API_ORIGIN + url;
}

/** Televersement d une image choisie dans la galerie ou prise en photo. */
export async function uploadImage(uri: string, name = 'photo.jpg'): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', { uri, name, type: 'image/jpeg' } as any);
  const token = await getToken();
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json();
}
