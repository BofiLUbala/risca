import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as net from 'net';

export interface ScanResult {
  clean: boolean;
  /** Motif du rejet, affiché à la personne qui téléverse. */
  reason?: string;
  /** Un moteur antivirus a réellement analysé le fichier. */
  scanned: boolean;
}

/** Octets de signature des formats acceptés (section 12). */
const SIGNATURES: Array<{ mime: RegExp; magic: number[][] }> = [
  { mime: /^image\/jpeg$/, magic: [[0xff, 0xd8, 0xff]] },
  { mime: /^image\/png$/, magic: [[0x89, 0x50, 0x4e, 0x47]] },
  { mime: /^image\/gif$/, magic: [[0x47, 0x49, 0x46, 0x38]] },
  { mime: /^image\/webp$/, magic: [[0x52, 0x49, 0x46, 0x46]] },
  { mime: /^application\/pdf$/, magic: [[0x25, 0x50, 0x44, 0x46]] },
  // DOCX est un ZIP ; DOC est un conteneur OLE2.
  { mime: /wordprocessingml|^application\/zip$/, magic: [[0x50, 0x4b, 0x03, 0x04]] },
  { mime: /^application\/msword$/, magic: [[0xd0, 0xcf, 0x11, 0xe0]] },
  { mime: /^video\/mp4$|^video\/quicktime$/, magic: [] },
];

/** Débuts de fichier d'exécutables, rejetés quel que soit le type déclaré. */
const EXECUTABLES: Array<{ label: string; magic: number[] }> = [
  { label: 'exécutable Windows', magic: [0x4d, 0x5a] },
  { label: 'exécutable Linux', magic: [0x7f, 0x45, 0x4c, 0x46] },
  { label: 'exécutable macOS', magic: [0xcf, 0xfa, 0xed, 0xfe] },
  { label: 'script shell', magic: [0x23, 0x21] },
];

/**
 * Analyse antivirus des fichiers téléversés (section 12).
 *
 * Deux niveaux, du plus fort au plus faible :
 *
 * 1. **ClamAV** si `CLAMAV_HOST` est renseigné. Le démon est interrogé par son
 *    protocole INSTREAM, sans dépendance supplémentaire.
 * 2. **Contrôle des octets de signature** sinon. Ce n'est pas un antivirus :
 *    cela empêche seulement un exécutable déguisé en image de passer. Le champ
 *    `scanned` dit lequel des deux a tourné, pour que l'exploitation sache si
 *    une vraie analyse a eu lieu.
 */
@Injectable()
export class AntivirusService {
  private readonly log = new Logger(AntivirusService.name);

  get engineConfigured(): boolean {
    return Boolean(process.env.CLAMAV_HOST);
  }

  async scanFile(filePath: string, mimeType: string): Promise<ScanResult> {
    let head: Buffer;
    try {
      const fh = await fs.open(filePath, 'r');
      head = Buffer.alloc(16);
      await fh.read(head, 0, 16, 0);
      await fh.close();
    } catch {
      return { clean: false, reason: 'Fichier illisible', scanned: false };
    }

    // Un exécutable est refusé même si ClamAV n'est pas disponible.
    for (const exe of EXECUTABLES) {
      if (exe.magic.every((b, i) => head[i] === b)) {
        return { clean: false, reason: `Fichier refusé : ${exe.label}`, scanned: false };
      }
    }

    const rule = SIGNATURES.find((s) => s.mime.test(mimeType));
    if (rule && rule.magic.length) {
      const matches = rule.magic.some((m) => m.every((b, i) => head[i] === b));
      if (!matches) {
        return {
          clean: false,
          reason: 'Le contenu du fichier ne correspond pas au type annoncé',
          scanned: false,
        };
      }
    }

    if (!this.engineConfigured) return { clean: true, scanned: false };

    try {
      const infected = await this.clamScan(filePath);
      if (infected) return { clean: false, reason: `Menace détectée : ${infected}`, scanned: true };
      return { clean: true, scanned: true };
    } catch (e: any) {
      // Antivirus injoignable : on refuse plutôt que d'accepter sans analyse.
      this.log.error(`ClamAV injoignable : ${e?.message ?? e}`);
      return {
        clean: false,
        reason: "L'analyse antivirus est indisponible, réessayez plus tard",
        scanned: false,
      };
    }
  }

  /** Protocole INSTREAM de clamd : taille sur 4 octets, puis le bloc, puis 0. */
  private clamScan(filePath: string): Promise<string | null> {
    const host = process.env.CLAMAV_HOST as string;
    const port = Number(process.env.CLAMAV_PORT ?? 3310);

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      let answer = '';

      socket.setTimeout(30000, () => {
        socket.destroy();
        reject(new Error('Delai depasse'));
      });
      socket.on('error', reject);
      socket.on('data', (d) => (answer += d.toString()));
      socket.on('end', () => {
        if (/OK$/m.test(answer.trim()) && !answer.includes('FOUND')) return resolve(null);
        const found = answer.match(/stream:\s*(.+)\s+FOUND/);
        resolve(found ? found[1] : 'menace inconnue');
      });

      socket.on('connect', async () => {
        socket.write('zINSTREAM\0');
        try {
          const data = await fs.readFile(filePath);
          for (let i = 0; i < data.length; i += 65536) {
            const chunk = data.subarray(i, i + 65536);
            const size = Buffer.alloc(4);
            size.writeUInt32BE(chunk.length, 0);
            socket.write(size);
            socket.write(chunk);
          }
          socket.write(Buffer.from([0, 0, 0, 0]));
        } catch (e) {
          socket.destroy();
          reject(e);
        }
      });
    });
  }
}
