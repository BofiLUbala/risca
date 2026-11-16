import { Lang } from './detect';

/** Un fournisseur traduit un texte d'une langue à l'autre ; il lève une erreur en cas d'échec (rien n'est mis en cache). */
export interface TranslationProvider {
  readonly name: string;
  translate(text: string, source: Lang, target: Lang): Promise<string>;
}

const TIMEOUT_MS = 10_000;

/** Découpe un texte en morceaux d'au plus `max` caractères, sur les fins de phrase puis les espaces. */
export function chunk(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    let cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
    if (cut < max * 0.4) cut = slice.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    parts.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * MyMemory (translated.net) : gratuit et sans clé (quota quotidien limité ; MYMEMORY_EMAIL l'augmente).
 * Fournisseur par défaut pour que la traduction marche sans configuration.
 */
class MyMemoryProvider implements TranslationProvider {
  readonly name = 'mymemory';
  constructor(private readonly email?: string) {}

  async translate(text: string, source: Lang, target: Lang): Promise<string> {
    const out: string[] = [];
    for (const piece of chunk(text, 450)) {
      if (!piece.trim()) {
        out.push(piece);
        continue;
      }
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q', piece);
      url.searchParams.set('langpair', `${source}|${target}`);
      if (this.email) url.searchParams.set('de', this.email);
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
      const data = (await res.json()) as { responseStatus?: number | string; responseData?: { translatedText?: string } };
      const translated = data.responseData?.translatedText;
      if (Number(data.responseStatus) !== 200 || !translated || /^MYMEMORY WARNING/i.test(translated)) {
        throw new Error(`MyMemory refused: ${data.responseStatus}`);
      }
      // Les espaces de début et de fin comptent à l'affichage (texte collé à une variable).
      const lead = piece.match(/^\s*/)?.[0] ?? '';
      const trail = piece.match(/\s*$/)?.[0] ?? '';
      out.push(lead + translated.trim() + trail);
    }
    return out.join('');
  }
}

/** DeepL (clé DEEPL_API_KEY ; une clé gratuite se termine par « :fx »). */
class DeepLProvider implements TranslationProvider {
  readonly name = 'deepl';
  constructor(private readonly key: string) {}

  async translate(text: string, _source: Lang, target: Lang): Promise<string> {
    const host = this.key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const res = await fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text], target_lang: target === 'en' ? 'EN-US' : 'FR' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
    const data = (await res.json()) as { translations?: { text: string }[] };
    const translated = data.translations?.[0]?.text;
    if (!translated) throw new Error('DeepL: empty response');
    return translated;
  }
}

/** LibreTranslate auto-hébergé (LIBRETRANSLATE_URL, clé facultative LIBRETRANSLATE_API_KEY). */
class LibreTranslateProvider implements TranslationProvider {
  readonly name = 'libretranslate';
  constructor(private readonly base: string, private readonly key?: string) {}

  async translate(text: string, source: Lang, target: Lang): Promise<string> {
    const res = await fetch(`${this.base.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source, target, format: 'text', api_key: this.key }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);
    const data = (await res.json()) as { translatedText?: string };
    if (!data.translatedText) throw new Error('LibreTranslate: empty response');
    return data.translatedText;
  }
}

/**
 * Choix du fournisseur par TRANSLATE_PROVIDER : « mymemory » (défaut), « deepl », « libretranslate » ou « off ».
 * Une clé manquante retombe sur MyMemory plutôt que de casser la traduction.
 */
export function createProvider(env: NodeJS.ProcessEnv = process.env): TranslationProvider | null {
  const choice = (env.TRANSLATE_PROVIDER || 'mymemory').toLowerCase();
  if (choice === 'off' || choice === 'none') return null;
  if (choice === 'deepl' && env.DEEPL_API_KEY) return new DeepLProvider(env.DEEPL_API_KEY);
  if (choice === 'libretranslate' && env.LIBRETRANSLATE_URL) return new LibreTranslateProvider(env.LIBRETRANSLATE_URL, env.LIBRETRANSLATE_API_KEY);
  return new MyMemoryProvider(env.MYMEMORY_EMAIL || undefined);
}
