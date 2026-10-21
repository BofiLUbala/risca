import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const run = promisify(exec);

export interface BackupResult {
  ok: boolean;
  file?: string;
  sizeBytes?: number;
  removed?: number;
  error?: string;
}

/**
 * Sauvegardes quotidiennes de la base (section 12).
 *
 * Appelle `pg_dump` sur `DATABASE_URL` et conserve les fichiers pendant
 * `BACKUP_RETENTION_DAYS` jours. L'absence de `pg_dump` sur la machine est
 * signalée clairement plutôt que silencieusement ignorée : une sauvegarde qu'on
 * croit active alors qu'elle ne tourne pas est pire que pas de sauvegarde.
 *
 * Ceci couvre la sauvegarde locale. Une copie hors site reste à la charge de
 * l'hébergement : un disque unique ne protège pas d'un incendie.
 */
@Injectable()
export class BackupService {
  private readonly log = new Logger(BackupService.name);

  private get dir(): string {
    return process.env.BACKUP_DIR || './backups';
  }

  private get retentionDays(): number {
    return Number(process.env.BACKUP_RETENTION_DAYS ?? 14);
  }

  /**
   * Commande pg_dump. Surchargeable quand PostgreSQL tourne dans un conteneur et
   * que l'outil n'est pas installe sur l'hote, par exemple :
   *   PG_DUMP_BIN="docker exec -i risac_postgres pg_dump"
   */
  private get pgDump(): string {
    return process.env.PG_DUMP_BIN || 'pg_dump';
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async scheduled() {
    if (process.env.DISABLE_SCHEDULERS === 'true') return;
    const r = await this.runBackup();
    if (r.ok) {
      this.log.log(
        `Sauvegarde : ${r.file} (${Math.round((r.sizeBytes ?? 0) / 1024)} Ko), ${r.removed} ancienne(s) supprimee(s)`,
      );
    } else {
      this.log.error(`Sauvegarde en echec : ${r.error}`);
    }
  }

  /**
   * Prisma ajoute `?schema=public` a l'URL ; pg_dump refuse ce parametre.
   * On le retire, en gardant l'URL de connexion elle-meme intacte.
   */
  private cleanUrl(url: string): string {
    const q = url.indexOf('?');
    return q === -1 ? url : url.slice(0, q);
  }

  async runBackup(): Promise<BackupResult> {
    const raw = process.env.DATABASE_URL;
    if (!raw) return { ok: false, error: 'DATABASE_URL absente' };
    const url = this.cleanUrl(process.env.BACKUP_DATABASE_URL || raw);

    try {
      await run(`${this.pgDump} --version`);
    } catch {
      return {
        ok: false,
        error: `${this.pgDump} introuvable. Renseignez PG_DUMP_BIN si PostgreSQL tourne dans un conteneur.`,
      };
    }

    const now = new Date();
    const stamp =
      now.toISOString().slice(0, 10) +
      '-' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');
    const file = path.join(this.dir, `risac-${stamp}.sql`);

    try {
      await fs.mkdir(this.dir, { recursive: true });
      // La sortie passe par stdout plutot que --file : le dump fonctionne aussi
      // quand pg_dump s'execute dans un conteneur, le fichier etant ecrit sur l'hote.
      // --no-owner : le dump se restaure sur une base dont le proprietaire differe.
      const { stdout } = await run(`${this.pgDump} --no-owner --format=plain "${url}"`, {
        maxBuffer: 1024 * 1024 * 256,
      });
      if (!stdout || stdout.length < 100) {
        return { ok: false, error: 'pg_dump n a rien produit' };
      }
      await fs.writeFile(file, stdout, 'utf-8');
      const stat = await fs.stat(file);
      const removed = await this.prune();
      return { ok: true, file: path.basename(file), sizeBytes: stat.size, removed };
    } catch (e: any) {
      return { ok: false, error: (e?.message ?? String(e)).slice(0, 200) };
    }
  }

  /** Supprime les sauvegardes plus anciennes que la duree de retention. */
  private async prune(): Promise<number> {
    const limit = Date.now() - this.retentionDays * 24 * 3600 * 1000;
    let removed = 0;
    try {
      for (const name of await fs.readdir(this.dir)) {
        if (!name.startsWith('risac-') || !name.endsWith('.sql')) continue;
        const full = path.join(this.dir, name);
        const stat = await fs.stat(full);
        if (stat.mtimeMs < limit) {
          await fs.unlink(full);
          removed++;
        }
      }
    } catch {
      /* dossier absent ou illisible : rien a purger */
    }
    return removed;
  }
}
