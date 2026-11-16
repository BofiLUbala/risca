import { createContext, Fragment, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { store } from '../api';
import { EN } from './en';

/**
 * Langue de l'application (français par défaut, anglais au choix), mêmes règles que le site web :
 * le texte français sert de clé, `t('Enregistrer')` renvoie « Save » en anglais, une clé absente reste en français.
 * Changer de langue remonte les écrans : chaque `t()` est réévalué, et l'écran ouvert est rouvert
 * (reprise de la dernière page). Le choix est gardé dans le stockage de l'appareil.
 */
export type Locale = 'fr' | 'en';
export const LOCALES: Locale[] = ['fr', 'en'];
const STORAGE_KEY = 'risac_lang';

let current: Locale = 'fr';

export function getLocale(): Locale {
  return current;
}

/** Locale Intl pour les dates et les nombres. */
export function intlLocale(): string {
  return current === 'en' ? 'en-US' : 'fr-FR';
}

type Vars = Record<string, string | number | null | undefined>;

/** Traduit un texte de l'interface (clé = texte français) ; `{nom}` est remplacé par `vars.nom`. */
export function t(fr: string, vars?: Vars): string {
  let s = current === 'en' ? (EN[fr] ?? fr) : fr;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? '') : m));
  return s;
}

/** Clés jamais traduites dans un objet localisé : valeurs techniques (routes, icônes, codes). */
const RAW_KEYS = new Set([
  'value', 'id', 'key', 'href', 'icon', 'type', 'code', 'role', 'roles', 'slug', 'field', 'path',
  'status', 'kind', 'color', 'tone', 'variant', 'name', 'iso2', 'currency', 'to', 'bg', 'fg',
]);
const proxies = new WeakMap<object, object>();

function isPlain(v: unknown): v is object {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return Array.isArray(v) || proto === Object.prototype || proto === null;
}

/** Table de libellés déclarée au niveau du module : chaque texte lu est traduit dans la langue du moment. */
export function localized<T>(obj: T): T {
  if (!isPlain(obj)) return obj;
  const cached = proxies.get(obj);
  if (cached) return cached as T;
  const p = new Proxy(obj, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof prop === 'symbol' || RAW_KEYS.has(prop)) return v;
      if (typeof v === 'string') return t(v);
      if (isPlain(v)) return localized(v);
      return v;
    },
  });
  proxies.set(obj, p);
  return p as T;
}

type Geo = { nameFr: string; nameEn?: string | null };
/** Nom d'un pays ou d'une province dans la langue choisie (le nom français sert de repli). */
export function geoName(g: Geo): string;
export function geoName(g?: Geo | null): string | undefined;
export function geoName(g?: Geo | null): string | undefined {
  if (!g) return undefined;
  return current === 'en' && g.nameEn ? g.nameEn : g.nameFr;
}

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}
const I18nContext = createContext<Ctx>({ locale: 'fr', setLocale: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>('fr');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void store
      .get(STORAGE_KEY)
      .catch(() => null)
      .then((v) => {
        if (v === 'en') {
          current = 'en';
          setState('en');
        }
        setReady(true);
      });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    current = l;
    setState(l);
    void store.set(STORAGE_KEY, l).catch(() => {});
  }, []);

  // Rien avant la lecture du choix : pas d'écran en français qui bascule une fraction de seconde après.
  if (!ready) return null;
  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  );
}

export function useI18n(): Ctx & { t: typeof t } {
  return { ...useContext(I18nContext), t };
}
