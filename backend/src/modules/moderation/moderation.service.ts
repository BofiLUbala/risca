import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus, ReportTargetType, Role, TicketCategory, TicketStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/** Signalements et tickets de support (section 11). */
@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private isHandler(role: string): boolean {
    return role === Role.MODERATOR || role === Role.SUPER_ADMIN;
  }

  /** Bouton Signaler present sur tout contenu. */
  async report(
    dto: { targetType: ReportTargetType; targetId: string; reason: string; details?: string; severity?: string },
    user: AuthUser,
  ) {
    const report = await this.prisma.report.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.details ?? null,
        severity: dto.severity ?? 'NORMAL',
        reporterId: user.id,
      },
    });

    // Signalements graves (maltraitance, fraude) : l Auditeur Ethique est saisi
    const recipients = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: report.severity === 'SERIOUS' ? { in: [Role.ETHICS_AUDITOR, Role.SUPER_ADMIN] } : { in: [Role.MODERATOR, Role.SUPER_ADMIN] },
      },
      select: { id: true },
    });

    await this.notifications.notifyMany(
      recipients.map((r) => r.id),
      {
        title: report.severity === 'SERIOUS' ? 'Signalement grave' : 'Nouveau signalement',
        body: `${dto.targetType} : ${dto.reason}`,
        link: `/moderation/${report.id}`,
        metadata: { reportId: report.id },
      },
    );

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'REPORT_FILED',
      entityType: dto.targetType,
      entityId: dto.targetId,
      metadata: { reportId: report.id, severity: report.severity },
    });

    return report;
  }

  async listReports(user: AuthUser, status?: ReportStatus) {
    const allowed: Role[] = [Role.MODERATOR, Role.SUPER_ADMIN, Role.ETHICS_AUDITOR];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Réservé à la modération et à la gouvernance');
    }
    return this.prisma.report.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(user.role === Role.ETHICS_AUDITOR ? { severity: 'SERIOUS' } : {}),
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true, role: true } },
        handler: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async resolveReport(id: string, status: ReportStatus, resolution: string, user: AuthUser) {
    if (!this.isHandler(user.role) && user.role !== Role.ETHICS_AUDITOR) {
      throw new ForbiddenException('Réservé à la modération et à la gouvernance');
    }

    const report = await this.prisma.report.update({
      where: { id },
      data: { status, resolution, handlerId: user.id, resolvedAt: new Date() },
    });

    await this.notifications.notify({
      userId: report.reporterId,
      title: 'Votre signalement a été traité',
      body: resolution,
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'REPORT_RESOLVED',
      entityType: 'Report',
      entityId: id,
      metadata: { status, resolution },
    });

    return report;
  }

  // ------------------------------------------------------------- tickets

  /** Tickets : problemes d activation, de mot de passe, de paiement. */
  async openTicket(
    dto: { category?: TicketCategory; subject: string; body: string },
    user: AuthUser,
  ) {
    const ticket = await this.prisma.ticket.create({
      data: {
        reference: `TK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        category: dto.category ?? TicketCategory.OTHER,
        subject: dto.subject,
        body: dto.body,
        openerId: user.id,
      },
    });

    const support = await this.prisma.user.findMany({
      where: { role: { in: [Role.MODERATOR, Role.SUPER_ADMIN] }, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notifications.notifyMany(
      support.map((s) => s.id),
      {
        title: `Nouveau ticket : ${ticket.reference}`,
        body: dto.subject,
        link: `/support?ticket=${ticket.id}`,
      },
    );

    return ticket;
  }

  async listTickets(user: AuthUser, status?: TicketStatus) {
    const where = this.isHandler(user.role)
      ? { ...(status ? { status } : {}) }
      : { openerId: user.id, ...(status ? { status } : {}) };

    return this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        opener: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getTicket(id: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        opener: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');
    if (ticket.openerId !== user.id && !this.isHandler(user.role)) {
      throw new ForbiddenException('Ce ticket ne vous appartient pas');
    }
    return ticket;
  }

  async respondTicket(id: string, message: string, user: AuthUser) {
    const ticket = await this.getTicket(id, user);
    const responses = [
      ...((ticket.responses as any[]) ?? []),
      {
        authorId: user.id,
        authorName: `${user.email}`,
        message,
        at: new Date().toISOString(),
      },
    ];

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        responses: responses as any,
        status: this.isHandler(user.role) ? TicketStatus.IN_PROGRESS : ticket.status,
        assigneeId: this.isHandler(user.role) ? user.id : ticket.assigneeId,
      },
    });

    const notifyId = this.isHandler(user.role) ? ticket.openerId : ticket.assigneeId;
    if (notifyId) {
      await this.notifications.notify({
        userId: notifyId,
        title: `Réponse sur le ticket ${ticket.reference}`,
        body: message.slice(0, 120),
        link: `/support?ticket=${id}`,
      });
    }

    return updated;
  }

  async closeTicket(id: string, user: AuthUser) {
    if (!this.isHandler(user.role)) {
      throw new ForbiddenException('Réservé au support');
    }
    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.RESOLVED, assigneeId: user.id },
    });
  }
}
