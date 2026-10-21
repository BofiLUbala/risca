import { Injectable } from '@nestjs/common';
import { DevicePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Appareils enregistrés pour les notifications push.
 *
 * Un jeton Firebase identifie une installation, pas une personne. Si quelqu'un
 * d'autre se connecte sur le même téléphone, le jeton doit changer de
 * propriétaire, sans quoi la personne précédente continuerait de recevoir les
 * notifications d'un appareil qu'elle ne détient plus. D'où le jeton unique et
 * la reprise du `userId` à chaque enregistrement.
 */
@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async register(user: AuthUser, token: string, platform: DevicePlatform, label?: string) {
    const userId = user.id;
    const previous = await this.prisma.device.findUnique({
      where: { token },
      select: { userId: true },
    });

    const device = await this.prisma.device.upsert({
      where: { token },
      update: { userId, platform, label: label ?? null, enabled: true, lastSeenAt: new Date() },
      create: { userId, token, platform, label: label ?? null },
      select: { id: true, platform: true, label: true, enabled: true, lastSeenAt: true },
    });

    // Changement de main sur un appareil partagé : l'événement est tracé.
    if (previous && previous.userId !== userId) {
      await this.audit.log({
        actorId: userId,
        actorRole: user.role,
        action: 'DEVICE_REASSIGNED',
        entityType: 'Device',
        entityId: device.id,
        metadata: { from: previous.userId, to: userId, platform },
      });
    }

    return device;
  }

  async unregister(userId: string, token: string) {
    // Limité à ses propres appareils : on ne coupe pas celui de quelqu'un d'autre.
    const res = await this.prisma.device.deleteMany({ where: { token, userId } });
    return { removed: res.count };
  }

  async listForUser(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, platform: true, label: true, enabled: true, lastSeenAt: true, createdAt: true },
    });
  }
}
