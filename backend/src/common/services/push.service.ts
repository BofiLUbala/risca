import { Injectable, Logger } from '@nestjs/common';
import { DevicePlatform, NotificationKind } from '@prisma/client';
import { App, applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body?: string | null;
  link?: string | null;
  kind: NotificationKind;
  /**
   * Le contenu touche un enfant ou la conduite d'une personne : le push affiche
   * un texte neutre, le détail reste dans l'application. Un push s'affiche sur
   * un écran verrouillé, donc devant n'importe qui.
   */
  sensitive?: boolean;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Jetons retirés parce que l'appareil ne les accepte plus. */
  pruned: number;
  /** Firebase n'est pas configuré : aucun envoi tenté. */
  skipped: boolean;
}

/** FCM n'accepte pas plus de 500 jetons par appel. */
const BATCH = 500;

/** Texte neutre affiché à la place d'un contenu sensible. */
const GENERIC: Record<string, { title: string; body: string }> = {
  default: { title: 'RISAC', body: 'Vous avez une nouvelle notification.' },
  [NotificationKind.MODERATION]: { title: 'RISAC', body: 'Une décision de modération vous concerne.' },
  [NotificationKind.SECURITY]: { title: 'RISAC', body: 'Une information de sécurité concerne votre compte.' },
  [NotificationKind.REMINDER]: { title: 'RISAC', body: 'Un suivi attend votre attention.' },
  [NotificationKind.INFO]: { title: 'RISAC', body: 'Une nouvelle information vous attend.' },
};

/**
 * Notifications push vers les appareils enregistrés, par Firebase Cloud
 * Messaging (Android, iOS et web à partir du même projet Firebase).
 *
 * Configuration par variables d'environnement : `FIREBASE_PROJECT_ID`,
 * `FIREBASE_CLIENT_EMAIL` et `FIREBASE_PRIVATE_KEY`, ou `GOOGLE_APPLICATION_CREDENTIALS`
 * pointant vers un fichier de compte de service. Sans configuration, le service
 * ne fait rien et le reste de la plateforme continue de fonctionner : les
 * notifications restent consultables dans l'application.
 */
@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);
  private app: App | null = null;
  private initialised = false;
  private warned = false;

  constructor(private prisma: PrismaService) {}

  /** Initialisation paresseuse : au premier envoi, une seule fois. */
  private get messaging(): Messaging | null {
    if (!this.initialised) {
      this.initialised = true;
      this.app = this.createApp();
    }
    return this.app ? getMessaging(this.app) : null;
  }

  private createApp(): App | null {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Dans un fichier .env la clé est sur une ligne, les sauts de ligne échappés.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const appName = 'risac-push';

    try {
      const existing = getApps().find((a) => a.name === appName);
      if (existing) return existing;

      if (projectId && clientEmail && privateKey) {
        return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, appName);
      }
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return initializeApp({ credential: applicationDefault() }, appName);
      }
    } catch (e: any) {
      this.log.error(`Firebase n'a pas pu démarrer : ${e?.message ?? e}`);
      return null;
    }

    this.log.warn(
      'Firebase non configuré : aucune notification push ne sera envoyée. ' +
        'Renseignez FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY.',
    );
    return null;
  }

  get configured(): boolean {
    return this.messaging !== null;
  }

  /** Texte réellement envoyé à l'appareil, selon la sensibilité du contenu. */
  private visibleText(payload: PushPayload): { title: string; body: string } {
    if (!payload.sensitive) {
      return { title: payload.title, body: payload.body ?? '' };
    }
    return GENERIC[payload.kind] ?? GENERIC.default;
  }

  /**
   * Envoie à tous les appareils actifs des utilisateurs donnés. N'échoue jamais
   * bruyamment : une panne de Firebase ne doit pas annuler l'opération métier
   * qui a déclenché la notification.
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<PushResult> {
    const empty: PushResult = { sent: 0, failed: 0, pruned: 0, skipped: true };
    const unique = [...new Set(userIds)].filter(Boolean);
    if (!unique.length) return empty;

    const messaging = this.messaging;
    if (!messaging) {
      if (!this.warned) {
        this.warned = true;
        this.log.warn('Push ignoré : Firebase non configuré.');
      }
      return empty;
    }

    const devices = await this.prisma.device.findMany({
      where: { userId: { in: unique }, enabled: true },
      select: { token: true, platform: true },
    });
    if (!devices.length) return { ...empty, skipped: false };

    const { title, body } = this.visibleText(payload);
    // Les données voyagent toujours en clair : on n'y met que de la navigation.
    const data: Record<string, string> = {
      kind: payload.kind,
      ...(payload.link ? { link: payload.link } : {}),
    };

    let sent = 0;
    let failed = 0;
    const dead: string[] = [];

    for (let i = 0; i < devices.length; i += BATCH) {
      const slice = devices.slice(i, i + BATCH);
      const hasWeb = slice.some((d) => d.platform === DevicePlatform.WEB);

      try {
        const res = await messaging.sendEachForMulticast({
          tokens: slice.map((d) => d.token),
          notification: { title, body },
          data,
          android: {
            priority: 'high',
            notification: { channelId: this.channelFor(payload.kind), sound: 'default' },
          },
          apns: { payload: { aps: { sound: 'default' } } },
          ...(hasWeb && payload.link
            ? { webpush: { fcmOptions: { link: this.absoluteLink(payload.link) } } }
            : {}),
        });

        sent += res.successCount;
        failed += res.failureCount;

        res.responses.forEach((r, idx) => {
          if (r.success) return;
          const code = r.error?.code ?? '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
          ) {
            dead.push(slice[idx].token);
          }
        });
      } catch (e: any) {
        failed += slice.length;
        this.log.error(`Envoi push en échec : ${e?.message ?? e}`);
      }
    }

    // Un jeton rejeté par Firebase ne reviendra jamais : on le retire.
    let pruned = 0;
    if (dead.length) {
      const res = await this.prisma.device.deleteMany({ where: { token: { in: dead } } });
      pruned = res.count;
    }

    return { sent, failed, pruned, skipped: false };
  }

  /** Canal Android : permet à la personne de couper une catégorie sans tout couper. */
  private channelFor(kind: NotificationKind): string {
    switch (kind) {
      case NotificationKind.VALIDATION_REQUEST:
      case NotificationKind.VALIDATION_RESULT:
        return 'validations';
      case NotificationKind.PAYMENT:
        return 'argent';
      case NotificationKind.SECURITY:
        return 'securite';
      case NotificationKind.MODERATION:
        return 'moderation';
      default:
        return 'general';
    }
  }

  /** Le web a besoin d'une URL absolue pour ouvrir la bonne page au clic. */
  private absoluteLink(link: string): string {
    if (link.startsWith('http')) return link;
    const base = (process.env.APP_WEB_URL ?? '').replace(/\/$/, '');
    return base ? `${base}${link}` : link;
  }
}
