import { Injectable } from '@nestjs/common';
import { NotificationKind, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from './push.service';

export interface NotifyInput {
  userId: string;
  kind?: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /**
   * Le texte nomme un enfant ou vise la conduite d'une personne : le push
   * affichera un libelle neutre, le detail restant dans l'application.
   */
  sensitive?: boolean;
  /** Enregistre la notification sans envoyer de push (import, rattrapage). */
  silent?: boolean;
}

/** Centre de notifications (section 11, commun a tous les roles). */
@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  /**
   * Envoi vers les appareils, en arriere-plan. Le push ne doit jamais faire
   * echouer l'operation metier qui l'a declenche : une erreur est journalisee
   * par PushService et la notification reste consultable dans l'application.
   */
  private pushTo(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
    if (input.silent) return;
    void this.push
      .sendToUsers(userIds, {
        title: input.title,
        body: input.body,
        link: input.link,
        kind: input.kind ?? NotificationKind.INFO,
        sensitive: input.sensitive,
      })
      .catch(() => undefined);
  }

  async notify(input: NotifyInput) {
    const created = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind ?? NotificationKind.INFO,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        metadata: (input.metadata ?? {}) as any,
      },
    });
    this.pushTo([input.userId], input);
    return created;
  }

  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
    if (!userIds.length) return { count: 0 };
    this.pushTo(userIds, input);
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: input.kind ?? NotificationKind.INFO,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        metadata: (input.metadata ?? {}) as any,
      })),
    });
  }

  /** Diffusion ciblee par le Super Admin : tous, pays, role ou region. */
  async broadcast(
    filter: { countryId?: string; provinceId?: string; role?: Role; userId?: string },
    input: Omit<NotifyInput, 'userId'>,
  ) {
    // Ciblage d'une seule personne : tous les autres filtres sont ignores.
    if (filter.userId) {
      await this.notify({ ...input, userId: filter.userId, kind: input.kind ?? NotificationKind.BROADCAST });
      return { count: 1 };
    }

    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(filter.countryId ? { countryId: filter.countryId } : {}),
        ...(filter.provinceId ? { provinceId: filter.provinceId } : {}),
        ...(filter.role ? { role: filter.role } : {}),
      },
      select: { id: true },
    });
    return this.notifyMany(
      users.map((u) => u.id),
      { ...input, kind: input.kind ?? NotificationKind.BROADCAST },
    );
  }

  /**
   * Chaine de supervision d'une structure : les personnes a prevenir quand un
   * dossier bouge. On ne diffuse jamais un evenement enfant au-dela de ce
   * perimetre, sinon un bailleur apprendrait l'existence de dossiers qu'il n'a
   * pas le droit de consulter.
   */
  async supervisorsOfOrphanage(orphanageId: string, exclude?: string): Promise<string[]> {
    const orphanage = await this.prisma.orphanage.findUnique({
      where: { id: orphanageId },
      select: {
        directorId: true,
        provinceId: true,
        countryId: true,
        ambassadorLinks: { select: { ambassadorId: true } },
      },
    });
    if (!orphanage) return [];

    const managers = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { role: Role.REGIONAL_MANAGER, provinceId: orphanage.provinceId },
          { role: Role.NATIONAL_MANAGER, countryId: orphanage.countryId },
        ],
      },
      select: { id: true },
    });

    const ids = new Set<string>();
    if (orphanage.directorId) ids.add(orphanage.directorId);
    for (const l of orphanage.ambassadorLinks) ids.add(l.ambassadorId);
    for (const m of managers) ids.add(m.id);
    if (exclude) ids.delete(exclude);
    return [...ids];
  }

  /** Tous les comptes actifs, pour les evenements qui concernent le reseau entier. */
  async allActiveUsers(exclude?: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    return users.map((u) => u.id).filter((id) => id !== exclude);
  }

  async listForUser(userId: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(onlyUnread ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }
}
