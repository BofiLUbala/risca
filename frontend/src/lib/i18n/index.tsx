'use client';

import { createContext, Fragment, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { EN } from './en';

/**
 * Langue de l'interface (français par défaut, anglais au choix).
 *
 * Le texte français sert de clé : `t('Enregistrer')` renvoie « Save » en anglais. Une clé absente
 * du dictionnaire reste en français, rien ne casse. Changer de langue remonte l'arbre de la page
 * (les données en cache SWR sont conservées), si bien que `t()` peut être appelé partout :
 * composants, fonctions utilitaires, messages d'erreur, boîtes de dialogue.
 */
export type Locale = 'fr' | 'en';
export const LOCALES: Locale[] = ['fr', 'en'];
const STORAGE_KEY = 'risac.lang';

let current: Locale = 'fr';

export function getLocale(): Locale {
  return current;
}

/** Locale Intl à utiliser pour les dates et les nombres. */
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

/** Clés jamais traduites dans un objet localisé : ce sont des valeurs techniques envoyées à l'API. */
const RAW_KEYS = new Set([
  'value', 'id', 'key', 'href', 'icon', 'type', 'code', 'role', 'roles', 'slug', 'field', 'path',
  'status', 'kind', 'swatch', 'color', 'tone', 'variant', 'className', 'name', 'iso2', 'currency', 'to',
]);
const proxies = new WeakMap<object, object>();

function isPlain(v: unknown): v is object {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return Array.isArray(v) || proto === Object.prototype || proto === null;
}

/**
 * Enveloppe une table de libellés déclarée au niveau du module (évaluée une seule fois, en français) :
 * chaque texte lu est traduit dans la langue du moment. Les clés techniques (`value`, `href`...) restent intactes.
 */
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

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}
const I18nContext = createContext<Ctx>({ locale: 'fr', setLocale: () => {} });

function applyLocale(l: Locale) {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>('fr');

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* stockage indisponible : français */
    }
    if (stored === 'en') {
      applyLocale('en');
      setState('en');
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    applyLocale(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* stockage indisponible : le choix vaut pour cette page */
    }
    setState(l);
    window.dispatchEvent(new CustomEvent('risac:locale', { detail: l }));
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      {/* Remonter l'arbre à chaque changement de langue : tous les `t()` sont réévalués. */}
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  );
}

export function useI18n(): Ctx & { t: typeof t } {
  return { ...useContext(I18nContext), t };
}

/** Texte traduit dans un composant serveur ou partagé : `<T>Accueil</T>`. */
export function T({ children, vars }: { children: string; vars?: Vars }) {
  useContext(I18nContext);
  return <>{t(children, vars)}</>;
}

type Geo = { nameFr: string; nameEn?: string | null };
/** Nom d'un pays ou d'une province dans la langue choisie (le nom français sert de repli). */
export function geoName(g: Geo): string;
export function geoName(g?: Geo | null): string | undefined;
export function geoName(g?: Geo | null): string | undefined {
  if (!g) return undefined;
  return current === 'en' && g.nameEn ? g.nameEn : g.nameFr;
}
