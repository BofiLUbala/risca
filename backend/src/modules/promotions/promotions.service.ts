import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, PromotionStatus, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { canPromote } from '../../common/promotion-paths';

const person = { select: { id: true, firstName: true, lastName: true, email: true, role: true, adminRank: true } } as const;
const include = { author: person, candidate: person, assignee: person, decidedBy: person } as const;

/**
 * Promotion d'un agent : le chef régional écrit une lettre, qui arrive chez le Super Admin n°1.
 * Le n°1 la tranche lui-même ou la transmet au n°2 ou au n°3 ; après lecture, celui-ci valide ou refuse.
 * Une lettre validée ouvre au chef régional l'espace de promotion : il promeut alors son candidat.
 */
@Injectable()
export class PromotionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private isAdmin(u: AuthUser) {
    return u.role === Role.SUPER_ADMIN;
  }
  private isPrimary(u: AuthUser) {
    return u.role === Role.SUPER_ADMIN && u.adminRank === 1;
  }

  /** Le Super Admin n°1 en service (à défaut, tout Super Admin actif) : premier destinataire des lettres. */
  private async primaryAdminId(): Promise<string> {
    const primary = await this.prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN, adminRank: 1, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (primary) return primary.id;
    const any = await this.prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN, status: UserStatus.ACTIVE }, select: { id: true } });
    if (!any) throw new BadRequestException('Aucun Super Admin actif pour recevoir la lettre');
    return any.id;
  }

  /** Un chef régional voit ses lettres ; le n°1 voit toutes les lettres ; le n°2 et le n°3 celles qui leur sont adressées. */
  private visibility(user: AuthUser) {
    if (user.role === Role.REGIONAL_MANAGER) return { authorId: user.id };
    if (this.isPrimary(user)) return {};
    if (this.isAdmin(user)) return { OR: [{ assigneeId: user.id }, { decidedById: user.id }, { forwardedById: user.id }] };
    throw new ForbiddenException('Réservé au chef régional et aux Super Admin');
  }

  async list(user: AuthUser) {
    return this.prisma.promotionLetter.findMany({
      where: this.visibility(user),
      orderBy: { createdAt: 'desc' },
      include,
    });
  }

  async get(id: string, user: AuthUser) {
    const letter = await this.prisma.promotionLetter.findFirst({ where: { AND: [{ id }, this.visibility(user)] }, include });
    if (!letter) throw new NotFoundException('Lettre introuvable');
    return letter;
  }

  /** Le chef régional écrit la lettre : elle part chez le Super Admin n°1. */
  async create(dto: { candidateId: string; requestedRole: Role; subject: string; body: string }, user: AuthUser) {
    if (user.role !== Role.REGIONAL_MANAGER) throw new ForbiddenException('Seul un chef régional écrit une lettre de promotion');
    const subject = dto.subject?.trim();
    const body = dto.body?.trim();
    if (!subject || !body) throw new BadRequestException('La lettre doit avoir un objet et un texte');
    if (body.length < 30) throw new BadRequestException('Expliquez le motif de la promotion dans la lettre (30 caractères au moins)');

    const candidate = await this.prisma.user.findUnique({ where: { id: dto.candidateId } });
    if (!candidate || candidate.status !== UserStatus.ACTIVE) throw new NotFoundException('Candidat introuvable ou inactif');
    if (!candidate.provinceId || candidate.provinceId !== user.provinceId) {
      throw new ForbiddenException('Ce candidat n’est pas dans votre province');
    }
    if (!canPromote(candidate.role, dto.requestedRole)) {
      throw new BadRequestException('Cette promotion n’est pas possible pour le rôle actuel du candidat');
    }
    const open = await this.prisma.promotionLetter.findFirst({
      where: { candidateId: candidate.id, status: { in: [PromotionStatus.SUBMITTED, PromotionStatus.FORWARDED, PromotionStatus.APPROVED] } },
      select: { id: true },
    });
    if (open) throw new BadRequestException('Une lettre est déjà en cours pour ce candidat');

    const assigneeId = await this.primaryAdminId();
    const letter = await this.prisma.promotionLetter.create({
      data: { authorId: user.id, candidateId: candidate.id, requestedRole: dto.requestedRole, subject, body, assigneeId },
      include,
    });
    await this.log(user, 'PROMOTION_LETTER_SENT', letter.id, { candidateId: candidate.id, requestedRole: dto.requestedRole });
    await this.notifications.notify({
      userId: assigneeId,
      kind: NotificationKind.VALIDATION_REQUEST,
      title: 'Nouvelle lettre de promotion',
      body: subject,
      link: '/lettres',
      metadata: { letterId: letter.id },
    });
    return letter;
  }

  /** Le Super Admin n°1 transmet la lettre au n°2 ou au n°3, qui la lira. */
  async forward(id: string, toUserId: string, user: AuthUser) {
    if (!this.isPrimary(user)) throw new ForbiddenException('Seul le Super Admin n°1 transmet une lettre');
    const letter = await this.get(id, user);
    if (!([PromotionStatus.SUBMITTED, PromotionStatus.FORWARDED] as PromotionStatus[]).includes(letter.status)) {
      throw new BadRequestException('Cette lettre est déjà tranchée');
    }
    const target = await this.prisma.user.findUnique({ where: { id: toUserId } });
    if (!target || target.role !== Role.SUPER_ADMIN || !target.adminRank || target.adminRank === 1 || target.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('La lettre ne peut être transmise qu’au Super Admin n°2 ou n°3');
    }
    const updated = await this.prisma.promotionLetter.update({
      where: { id },
      data: { status: PromotionStatus.FORWARDED, assigneeId: target.id, forwardedById: user.id, forwardedAt: new Date() },
      include,
    });
    await this.log(user, 'PROMOTION_LETTER_FORWARDED', id, { to: target.id, rank: target.adminRank });
    await this.notifications.notify({
      userId: target.id,
      kind: NotificationKind.VALIDATION_REQUEST,
      title: 'Lettre de promotion à lire',
      body: letter.subject,
      link: '/lettres',
      metadata: { letterId: id },
    });
    return updated;
  }

  /** Après lecture, le Super Admin chargé de la lettre valide ou refuse. */
  async decide(id: string, approve: boolean, note: string | undefined, user: AuthUser) {
    if (!this.isAdmin(user)) throw new ForbiddenException('Réservé aux Super Admin');
    const letter = await this.get(id, user);
    if (!([PromotionStatus.SUBMITTED, PromotionStatus.FORWARDED] as PromotionStatus[]).includes(letter.status)) {
      throw new BadRequestException('Cette lettre est déjà tranchée');
    }
    // Le n°1 peut trancher toute lettre en attente ; le n°2 et le n°3 seulement celles qui leur ont été transmises.
    if (!this.isPrimary(user) && letter.assigneeId !== user.id) {
      throw new ForbiddenException('Cette lettre ne vous a pas été transmise');
    }
    const text = note?.trim();
    if (!approve && !text) throw new BadRequestException('Indiquez le motif du refus');

    const updated = await this.prisma.promotionLetter.update({
      where: { id },
      data: {
        status: approve ? PromotionStatus.APPROVED : PromotionStatus.REJECTED,
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: text ?? null,
      },
      include,
    });
    await this.log(user, approve ? 'PROMOTION_LETTER_APPROVED' : 'PROMOTION_LETTER_REJECTED', id, { note: text });
    await this.notifications.notify({
      userId: letter.authorId,
      kind: NotificationKind.VALIDATION_RESULT,
      title: approve ? 'Lettre validée : l’espace de promotion est ouvert' : 'Lettre de promotion refusée',
      body: approve ? letter.subject : text,
      link: '/lettres',
      metadata: { letterId: id, result: approve ? 'APPROVED' : 'REJECTED' },
    });
    return updated;
  }

  /** Espace de promotion : une lettre validée permet au chef régional de promouvoir son candidat, une seule fois. */
  async execute(id: string, user: AuthUser) {
    const letter = await this.get(id, user);
    if (letter.authorId !== user.id || user.role !== Role.REGIONAL_MANAGER) {
      throw new ForbiddenException('Seul l’auteur de la lettre peut promouvoir');
    }
    if (letter.status !== PromotionStatus.APPROVED) throw new BadRequestException('La lettre n’a pas été validée');

    const candidate = await this.prisma.user.findUnique({ where: { id: letter.candidateId } });
    if (!candidate || candidate.status !== UserStatus.ACTIVE) throw new BadRequestException('Le candidat n’est plus actif');
    if (candidate.provinceId !== user.provinceId) throw new ForbiddenException('Ce candidat n’est plus dans votre province');
    if (!canPromote(candidate.role, letter.requestedRole)) {
      throw new BadRequestException('Le rôle actuel du candidat a changé : la promotion n’est plus possible');
    }
    if (candidate.role === Role.AMBASSADOR) {
      const active = await this.prisma.childAssignment.count({ where: { ambassadorId: candidate.id, active: true } });
      if (active > 0) {
        throw new BadRequestException(`Ce candidat suit encore ${active} enfant(s) : réaffectez-les avant de le promouvoir`);
      }
    }

    const from = candidate.role;
    await this.prisma.$transaction([
      // Nouveau rôle ; les sessions en cours sont fermées pour que les droits du nouveau rôle s'appliquent dès la reconnexion.
      this.prisma.user.update({ where: { id: candidate.id }, data: { role: letter.requestedRole, tokenVersion: { increment: 1 } } }),
      this.prisma.refreshToken.updateMany({ where: { userId: candidate.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.promotionLetter.update({ where: { id }, data: { status: PromotionStatus.EXECUTED, executedAt: new Date() } }),
    ]);
    await this.log(user, 'USER_PROMOTED', id, { candidateId: candidate.id, from, to: letter.requestedRole });
    await this.notifications.notify({
      userId: candidate.id,
      kind: NotificationKind.INFO,
      title: 'Vous êtes promu',
      body: `Nouveau rôle : ${letter.requestedRole}. Reconnectez-vous pour y accéder.`,
      link: '/connexion',
      metadata: { letterId: id },
    });
    return this.get(id, user);
  }

  private log(user: AuthUser, action: string, id: string, metadata: Record<string, unknown>) {
    return this.audit.log({ actorId: user.id, actorRole: user.role, action, entityType: 'PromotionLetter', entityId: id, metadata });
  }
}
