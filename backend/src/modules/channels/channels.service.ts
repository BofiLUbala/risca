import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { ContentSafetyService } from '../../common/services/content-safety.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/** Canaux de messagerie (section 9). */
@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private safety: ContentSafetyService,
  ) {}

  private isModerator(role: string): boolean {
    return role === Role.SUPER_ADMIN || role === Role.MODERATOR;
  }

  /** Mes canaux, avec le compteur de messages non lus. */
  async myChannels(user: AuthUser) {
    const memberships = await this.prisma.channelMember.findMany({
      where: { userId: user.id },
      include: {
        channel: {
          include: {
            orphanage: { select: { id: true, name: true } },
            _count: { select: { members: true, messages: true } },
          },
        },
      },
    });

    const result = [];
    for (const m of memberships) {
      const unread = await this.prisma.message.count({
        where: {
          channelId: m.channelId,
          hidden: false,
          authorId: { not: user.id },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      const last = await this.prisma.message.findFirst({
        where: { channelId: m.channelId, hidden: false },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
      });
      result.push({ ...m.channel, canWrite: m.canWrite, unread, lastMessage: last });
    }

    return result.sort((a, b) => {
      const ta = a.lastMessage?.createdAt?.getTime() ?? 0;
      const tb = b.lastMessage?.createdAt?.getTime() ?? 0;
      return tb - ta;
    });
  }

  async assertMember(channelId: string, user: AuthUser) {
    if (this.isModerator(user.role)) return null;
    const member = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });
    if (!member) throw new ForbiddenException('Vous n’êtes pas membre de ce canal');
    return member;
  }

  async messages(channelId: string, user: AuthUser, take = 50, before?: string) {
    await this.assertMember(channelId, user);

    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        ...(this.isModerator(user.role) ? {} : { hidden: false }),
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(take),
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
      },
    });

    await this.prisma.channelMember
      .update({
        where: { channelId_userId: { channelId, userId: user.id } },
        data: { lastReadAt: new Date() },
      })
      .catch(() => null);

    return messages.reverse();
  }

  /**
   * Envoi d un message. Le canal Bailleur <-> Ambassadeur est modere et
   * interdit toute coordonnee personnelle; aucun contact direct avec l enfant.
   */
  async send(
    channelId: string,
    dto: { content: string; attachments?: string[] },
    user: AuthUser,
  ) {
    const member = await this.assertMember(channelId, user);

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Canal introuvable');

    if (member && !member.canWrite) {
      throw new ForbiddenException('Ce canal est en lecture seule pour votre rôle');
    }
    if (channel.readOnlyForMembers && !this.isModerator(user.role)) {
      const writers: Role[] = [Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER];
      if (!writers.includes(user.role as Role) && !member?.canWrite) {
        throw new ForbiddenException('Seuls les administrateurs ecrivent dans ce canal');
      }
    }

    if (!dto.content || dto.content.trim().length === 0) {
      if (!dto.attachments?.length) throw new BadRequestException('Message vide');
    }

    // Canal bailleur : moderation renforcee, pas de coordonnees
    if (channel.type === ChannelType.DONOR_AMBASSADOR || channel.moderated) {
      let lastName: string | undefined;
      if (channel.childId) {
        const child = await this.prisma.child.findUnique({
          where: { id: channel.childId },
          select: { lastName: true },
        });
        lastName = child?.lastName;
      }
      const check = this.safety.check(dto.content ?? '', lastName);
      if (!check.safe) {
        throw new BadRequestException({
          message: 'Message bloque : coordonnees personnelles ou donnees sensibles interdites',
          violations: check.violations,
        });
      }
    }

    const message = await this.prisma.message.create({
      data: {
        channelId,
        authorId: user.id,
        content: dto.content ?? '',
        attachments: dto.attachments ?? [],
        readBy: [user.id],
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
      },
    });

    return message;
  }

  /**
   * Accuse de lecture (section 9). En plus de la date de derniere lecture du
   * canal, chaque message non encore lu porte desormais l'identifiant du
   * lecteur : l'auteur peut savoir qui a lu son message, pas seulement quand.
   */
  async markRead(channelId: string, user: AuthUser) {
    await this.prisma.channelMember
      .update({
        where: { channelId_userId: { channelId, userId: user.id } },
        data: { lastReadAt: new Date() },
      })
      .catch(() => null);

    const unread = await this.prisma.message.findMany({
      where: { channelId, hidden: false, NOT: { readBy: { has: user.id } } },
      select: { id: true, readBy: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    for (const m of unread) {
      await this.prisma.message.update({
        where: { id: m.id },
        data: { readBy: { set: [...m.readBy, user.id] } },
      });
    }

    return { success: true, marked: unread.length };
  }

  async pin(messageId: string, pinned: boolean, user: AuthUser) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message introuvable');
    await this.assertMember(message.channelId, user);
    return this.prisma.message.update({ where: { id: messageId }, data: { pinned } });
  }

  async search(channelId: string, q: string, user: AuthUser) {
    await this.assertMember(channelId, user);
    return this.prisma.message.findMany({
      where: { channelId, hidden: false, content: { contains: q, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  /** Masquer un message ou un fichier (Moderateur, section 11). */
  async hideMessage(messageId: string, reason: string, user: AuthUser) {
    if (!this.isModerator(user.role)) {
      throw new ForbiddenException('Seul un modérateur peut masquer un message');
    }
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { hidden: true, hiddenReason: reason },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'MESSAGE_HIDDEN',
      entityType: 'Message',
      entityId: messageId,
      metadata: { reason },
    });
    return message;
  }

  /**
   * Canal bailleur <-> ambassadeur, lie a un enfant parraine.
   * Le bailleur ecrit a l ambassadeur, jamais a l enfant.
   */
  async openDonorChannel(childId: string, user: AuthUser) {
    if (user.role !== Role.DONOR && user.role !== Role.PARTNER) {
      throw new ForbiddenException('Ce canal est réservé aux bailleurs');
    }

    const sponsorship = await this.prisma.sponsorship.findFirst({
      where: { donorId: user.id, childId, status: 'ACTIVE' },
    });
    if (!sponsorship) {
      throw new ForbiddenException('Vous devez parrainer cet enfant pour ouvrir ce canal');
    }

    const assignment = await this.prisma.childAssignment.findFirst({
      where: { childId, active: true },
    });
    if (!assignment) throw new BadRequestException('Aucun ambassadeur assigné a cet enfant');

    const existing = await this.prisma.channel.findFirst({
      where: {
        type: ChannelType.DONOR_AMBASSADOR,
        childId,
        members: { some: { userId: user.id } },
      },
    });
    if (existing) return existing;

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { firstName: true },
    });

    const channel = await this.prisma.channel.create({
      data: {
        type: ChannelType.DONOR_AMBASSADOR,
        name: `Parrainage de ${child.firstName}`,
        childId,
        moderated: true,
        members: {
          create: [{ userId: user.id }, { userId: assignment.ambassadorId }],
        },
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DONOR_CHANNEL_OPENED',
      entityType: 'Channel',
      entityId: channel.id,
      metadata: { childId, ambassadorId: assignment.ambassadorId },
    });

    return channel;
  }

  /** Creation d un canal par un administrateur. */
  async create(
    dto: { type: ChannelType; name: string; description?: string; memberIds?: string[]; orphanageId?: string; provinceId?: string },
    user: AuthUser,
  ) {
    const allowed: Role[] = [Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Votre rôle ne permet pas de créer un canal');
    }

    const channel = await this.prisma.channel.create({
      data: {
        type: dto.type,
        name: dto.name,
        description: dto.description ?? null,
        orphanageId: dto.orphanageId ?? null,
        provinceId: dto.provinceId ?? null,
        members: {
          create: [
            { userId: user.id },
            ...(dto.memberIds ?? []).filter((id) => id !== user.id).map((userId) => ({ userId })),
          ],
        },
      },
      include: { members: true },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHANNEL_CREATED',
      entityType: 'Channel',
      entityId: channel.id,
      metadata: { type: dto.type, members: channel.members.length },
    });

    return channel;
  }

  async addMember(channelId: string, userId: string, canWrite: boolean, user: AuthUser) {
    const allowed: Role[] = [Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Votre rôle ne permet pas de gérer les membres');
    }
    return this.prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: { canWrite },
      create: { channelId, userId, canWrite },
    });
  }

  async removeMember(channelId: string, userId: string, user: AuthUser) {
    const allowed: Role[] = [Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Votre rôle ne permet pas de gérer les membres');
    }
    await this.prisma.channelMember.deleteMany({ where: { channelId, userId } });
    return { success: true };
  }

  /** Le Super Admin et le Moderateur peuvent consulter tous les canaux. */
  async allChannels(user: AuthUser) {
    if (!this.isModerator(user.role)) {
      throw new ForbiddenException('Réservé au Super Admin et au Modérateur');
    }
    return this.prisma.channel.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        orphanage: { select: { id: true, name: true } },
        _count: { select: { members: true, messages: true } },
      },
    });
  }

  async get(channelId: string, user: AuthUser) {
    await this.assertMember(channelId, user);
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        orphanage: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!channel) throw new NotFoundException('Canal introuvable');
    return channel;
  }
}
