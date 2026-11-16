'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getLocale, Locale } from './index';

/**
 * Traduction du contenu saisi par les personnes (publications, descriptions, messages, notifications,
 * messages d'erreur du serveur...). Le texte part au service de traduction du backend (POST /translate),
 * qui garde chaque traduction en cache : aucune clé de fournisseur n'est dans le navigateur.
 * Tant que la traduction n'est pas arrivée, ou si elle échoue, le texte d'origine s'affiche.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const BATCH = 50;
const DELAY_MS = 40;

const cache = new Map<string, string>();
const queue = new Map<string, { text: string; target: Locale; waiters: ((s: string) => void)[] }>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

const keyOf = (text: string, target: Locale) => `${target}\u0000${text}`;

const FR_WORDS = new Set('le la les un une des du de et est sont pour avec dans sur par pas que qui ce cette au aux nous vous il elle ils son sa ses leur mais ou été être très plus aussi tout notre votre merci bonjour enfant enfants'.split(' '));
const EN_WORDS = new Set('the a an and is are was were for with in on by not that this to of we you he she they his her their but or be been have has had very more also all our your thank thanks hello child children'.split(' '));

/** Langue probable (fr / en), ou null : nom propre, chiffres, mot isolé. Même règle que le backend. */
export function detectLang(text: string): Locale | null {
  const words = text.toLowerCase().replace(/’/g, "'").match(/[a-zà-ÿœ']+/g) ?? [];
  let fr = (text.match(/[éèêàçùâîôûëïœ]/gi) ?? []).length * 0.5;
  let en = 0;
  for (let w of words) {
    if (/^[ldjmnstc]'/.test(w)) {
      fr++;
      w = w.slice(2);
    } else if (/'s$/.test(w)) {
      en++;
      w = w.slice(0, -2);
    }
    if (FR_WORDS.has(w)) fr++;
    if (EN_WORDS.has(w)) en++;
  }
  if (fr === 0 && en === 0) return null;
  if (fr > en * 1.2) return 'fr';
  if (en > fr * 1.2) return 'en';
  return null;
}

function needsTranslation(text: string, target: Locale): boolean {
  if (!text.trim()) return false;
  // Sans indice clair, un texte de plusieurs mots est supposé français (langue principale du réseau).
  const lang = detectLang(text) ?? (target === 'en' && (text.match(/\p{L}{2,}/gu) ?? []).length >= 2 ? 'fr' : null);
  return lang !== null && lang !== target;
}

function emit() {
  listeners.forEach((l) => l());
}

async function flush() {
  timer = null;
  const items = [...queue.entries()];
  queue.clear();
  for (const target of ['fr', 'en'] as Locale[]) {
    const mine = items.filter(([, v]) => v.target === target);
    for (let i = 0; i < mine.length; i += BATCH) {
      const slice = mine.slice(i, i + BATCH);
      let out: string[] | null = null;
      try {
        const res = await fetch(`${API_URL}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: slice.map(([, v]) => v.text), target }),
        });
        if (res.ok) out = ((await res.json()) as { translations?: string[] }).translations ?? null;
      } catch {
        /* réseau indisponible : le texte d'origine reste affiché */
      }
      slice.forEach(([key, v], n) => {
        const value = out?.[n] ?? v.text;
        cache.set(key, value);
        v.waiters.forEach((w) => w(value));
      });
    }
  }
  emit();
}

function request(text: string, target: Locale, waiter?: (s: string) => void) {
  const key = keyOf(text, target);
  if (cache.has(key)) {
    waiter?.(cache.get(key)!);
    return;
  }
  const pending = queue.get(key);
  if (pending) {
    if (waiter) pending.waiters.push(waiter);
    return;
  }
  queue.set(key, { text, target, waiters: waiter ? [waiter] : [] });
  if (!timer) timer = setTimeout(flush, DELAY_MS);
}

/** Traduction ponctuelle (ex. message d'erreur renvoyé par l'API) dans la langue de l'interface. */
export function translateText(text: string, target: Locale = getLocale()): Promise<string> {
  if (typeof window === 'undefined' || !needsTranslation(text, target)) return Promise.resolve(text);
  return new Promise((resolve) => request(text, target, resolve));
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Texte saisi par une personne, affiché dans la langue de l'interface (traduit à la demande, mis en cache). */
export function useTranslated(text: string | null | undefined): string {
  const target = getLocale();
  const value = text ?? '';
  const wanted = !!value && needsTranslation(value, target);
  const translated = useSyncExternalStore(
    subscribe,
    () => (wanted ? cache.get(keyOf(value, target)) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (wanted) request(value, target);
  }, [wanted, value, target]);
  return translated ?? value;
}

/** `<Tr text={post.content} />` : contenu dynamique traduit dans la langue de l'interface. */
export function Tr({ text }: { text: string | null | undefined }) {
  return <>{useTranslated(text)}</>;
}
