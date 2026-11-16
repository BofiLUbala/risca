import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { detectLang, Lang } from './detect';
import { createProvider, TranslationProvider } from './providers';

const MEMORY_MAX = 5000;

/**
 * Langue d'origine : détectée, ou, sans indice clair, le français quand on traduit vers l'anglais (le réseau écrit
 * surtout en français, ex. « Operation chirurgicale urgente » sans accent ni mot outil). Un mot seul reste tel quel.
 */
export function guessSource(text: string, target: Lang): Lang | null {
  const lang = detectLang(text);
  if (lang) return lang;
  return target === 'en' && (text.trim().match(/\p{L}{2,}/gu) ?? []).length >= 2 ? 'fr' : null;
}
const CONCURRENCY = 4;

/**
 * Traduction du contenu saisi par les personnes (publications, descriptions, messages, notifications...).
 * Un texte déjà dans la langue voulue est renvoyé tel quel ; sinon il passe par le fournisseur une seule fois :
 * le résultat est gardé en mémoire et dans la table TranslationCache.
 * En cas d'échec, le texte d'origine est renvoyé (jamais d'erreur à l'écran pour une traduction manquée).
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly memory = new Map<string, string>();
  private readonly inflight = new Map<string, Promise<string | null>>();
  private provider: TranslationProvider | null = createProvider();
  private dbAvailable = true;

  constructor(private readonly prisma: PrismaService) {}

  get providerName(): string {
    return this.provider?.name ?? 'off';
  }

  /** Pour les tests : remplace le fournisseur. */
  useProvider(p: TranslationProvider | null) {
    this.provider = p;
  }

  static keyOf(text: string, target: Lang): string {
    return createHash('sha256').update(`${target}|${text}`).digest('hex');
  }

  async translateMany(texts: string[], target: Lang): Promise<string[]> {
    const out = texts.slice();
    const todo: { i: number; text: string; key: string; source: Lang }[] = [];

    texts.forEach((text, i) => {
      const source = text.trim() ? guessSource(text, target) : null;
      if (!source || source === target) return;
      const key = TranslateService.keyOf(text, target);
      const hit = this.memory.get(key);
      if (hit !== undefined) out[i] = hit;
      else todo.push({ i, text, key, source });
    });
    if (!todo.length) return out;

    const fromDb = await this.readCache(todo.map((x) => x.key));
    const missing = todo.filter((x) => {
      const hit = fromDb.get(x.key);
      if (hit === undefined) return true;
      this.remember(x.key, hit);
      out[x.i] = hit;
      return false;
    });

    if (this.provider) {
      for (let n = 0; n < missing.length; n += CONCURRENCY) {
        await Promise.all(
          missing.slice(n, n + CONCURRENCY).map(async (x) => {
            const res = await this.translateOne(x.text, x.source, target, x.key);
            if (res !== null) out[x.i] = res;
          }),
        );
      }
    }
    return out;
  }

  private translateOne(text: string, source: Lang, target: Lang, key: string): Promise<string | null> {
    const running = this.inflight.get(key);
    if (running) return running;
    const provider = this.provider!;
    const p = (async () => {
      try {
        const translated = await provider.translate(text, source, target);
        this.remember(key, translated);
        await this.writeCache(key, source, target, translated);
        return translated;
      } catch (e) {
        this.logger.warn(`Traduction ${source}→${target} impossible : ${(e as Error).message}`);
        return null;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  private remember(key: string, value: string) {
    if (this.memory.size >= MEMORY_MAX) this.memory.delete(this.memory.keys().next().value as string);
    this.memory.set(key, value);
  }

  private async readCache(keys: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!this.dbAvailable || !keys.length) return map;
    try {
      const rows = await this.prisma.translationCache.findMany({ where: { key: { in: keys } }, select: { key: true, translated: true } });
      for (const r of rows) map.set(r.key, r.translated);
    } catch (e) {
      this.disableDb(e);
    }
    return map;
  }

  private async writeCache(key: string, source: Lang, target: Lang, translated: string) {
    if (!this.dbAvailable) return;
    try {
      await this.prisma.translationCache.createMany({
        data: [{ key, source, target, translated, provider: this.providerName }],
        skipDuplicates: true,
      });
    } catch (e) {
      this.disableDb(e);
    }
  }

  /** Table absente (schéma pas encore poussé) : on continue avec le seul cache mémoire. */
  private disableDb(e: unknown) {
    this.dbAvailable = false;
    this.logger.warn(`Cache de traduction en base indisponible, cache mémoire seul : ${(e as Error).message}`);
  }
}
