import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ApprovalKind,
  ApprovalStatus,
  ApprovalStepStatus,
  NotificationKind,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { SettingsService } from '../../common/services/settings.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

export interface StepSpec {
  order: number;
  role: Role;
  approverId?: string | null;
}

/**
 * Moteur des circuits de validation (section 7 du plan fonctionnel).
 * Un ApprovalRequest porte une suite d etapes ordonnees; chaque etape
 * designe un role (et parfois un approbateur precis). Une validation
 * en attente depuis plus de N heures remonte au niveau superieur.
 */
type CompletionHandler = (request: { id: string; entityId: string }, user: AuthUser) => Promise<unknown>;

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);
  private readonly completionHandlers = new Map<ApprovalKind, CompletionHandler[]>();

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private settings: SettingsService,
  ) {}

  /**
   * Un module metier declare ce qui se passe quand le dernier approbateur valide
   * (activation du dossier, application d'une modification...). Le moteur reste
   * ainsi independant des modules qui l'utilisent.
   */
  onApproved(kind: ApprovalKind, handler: CompletionHandler) {
    this.completionHandlers.set(kind, [...(this.completionHandlers.get(kind) ?? []), handler]);
  }

  /** Une validation deja appliquee ne doit pas l'etre deux fois (route manuelle de repli). */
  async isApplied(requestId: string): Promise<boolean> {
    const count = await this.prisma.auditLog.count({
      where: { action: 'APPROVAL_APPLIED', metadata: { path: ['requestId'], equals: requestId } },
    });
    return count > 0;
  }

  async markApplied(requestId: string, entityType: string, entityId: string, user: AuthUser) {
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'APPROVAL_APPLIED',
      entityType,
      entityId,
      metadata: { requestId },
    });
  }

  private async runCompletion(request: { id: string; kind: ApprovalKind; entityId: string }, user: AuthUser) {
    for (const handler of this.completionHandlers.get(request.kind) ?? []) {
      try {
        await handler({ id: request.id, entityId: request.entityId }, user);
      } catch (err) {
        // La validation reste acquise : l'application peut etre relancee a la main.
        this.logger.error(`Application de la validation ${request.id} (${request.kind}) : ${(err as Error).message}`);
      }
    }
  }

  async create(params: {
    kind: ApprovalKind;
    entityId: string;
    entityLabel?: string;
    requestedById: string;
    steps: StepSpec[];
    payload?: Record<string, unknown>;
  }) {
    if (!params.steps.length) throw new BadRequestException('Un circuit doit comporter au moins une étape');

    const hours = await this.settings.escalationHours();
    const dueAt = new Date(Date.now() + hours * 3600000);

    // Un seul circuit actif par entite
    await this.prisma.approvalRequest.updateMany({
      where: { kind: params.kind, entityId: params.entityId, status: ApprovalStatus.PENDING },
      data: { status: ApprovalStatus.REJECTED, resolvedAt: new Date() },
    });

    const request = await this.prisma.approvalRequest.create({
      data: {
        kind: params.kind,
        entityId: params.entityId,
        entityLabel: params.entityLabel ?? null,
        requestedById: params.requestedById,
        payload: (params.payload ?? {}) as any,
        currentStepOrder: params.steps[0].order,
        steps: {
          create: params.steps.map((s) => ({
            order: s.order,
            role: s.role,
            approverId: s.approverId ?? null,
            dueAt: s.order === params.steps[0].order ? dueAt : null,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    await this.notifyStep(request.id, params.steps[0].order);
    await this.audit.log({
      actorId: params.requestedById,
      action: 'APPROVAL_REQUESTED',
      entityType: params.kind,
      entityId: params.entityId,
      metadata: { requestId: request.id, steps: params.steps.length },
    });

    return request;
  }

  /** Qui doit agir a cette etape : approbateur nomme, sinon tous les porteurs du role dans le perimetre. */
  private async resolveApprovers(requestId: string, order: number): Promise<string[]> {
    const step = await this.prisma.approvalStep.findFirst({ where: { requestId, order } });
    if (!step) return [];
    if (step.approverId) return [step.approverId];

    const users = await this.prisma.user.findMany({
      where: { role: step.role, status: 'ACTIVE' },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async notifyStep(requestId: string, order: number) {
    const request = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    const approvers = await this.resolveApprovers(requestId, order);
    if (!approvers.length) return;
    await this.notifications.notifyMany(approvers, {
      kind: NotificationKind.VALIDATION_REQUEST,
      title: 'Validation attendue',
      body: request.entityLabel ?? request.kind,
      link: `/validations/${requestId}`,
      metadata: { requestId, kind: request.kind, entityId: request.entityId },
    });
  }

  /** Une etape peut-elle etre decidee par cet utilisateur ? */
  private async assertCanDecide(requestId: string, order: number, user: AuthUser) {
    const step = await this.prisma.approvalStep.findFirst({ where: { requestId, order } });
    if (!step) throw new NotFoundException('Étape introuvable');
    if (step.status !== ApprovalStepStatus.PENDING) {
      throw new BadRequestException('Cette étape est déjà décidée');
    }
    if (step.approverId && step.approverId !== user.id) {
      // Le Super Admin peut toujours trancher (remontee automatique)
      if (user.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Cette validation est attribuee a un autre utilisateur');
      }
    }
    if (!step.approverId && step.role !== user.role && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Votre rôle ne correspond pas a cette étape');
    }
    return step;
  }

  async approve(requestId: string, user: AuthUser, comment?: string) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!request) throw new NotFoundException('Circuit introuvable');
    if (request.status !== ApprovalStatus.PENDING) throw new BadRequestException('Circuit déjà clos');

    const step = await this.assertCanDecide(requestId, request.currentStepOrder, user);

    await this.prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: ApprovalStepStatus.APPROVED,
        approverId: user.id,
        comment: comment ?? null,
        decidedAt: new Date(),
      },
    });

    const next = request.steps.find((s) => s.order > request.currentStepOrder);

    if (next) {
      const hours = await this.settings.escalationHours();
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { currentStepOrder: next.order },
      });
      await this.prisma.approvalStep.update({
        where: { id: next.id },
        data: { dueAt: new Date(Date.now() + hours * 3600000) },
      });
      await this.notifyStep(requestId, next.order);
    } else {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: ApprovalStatus.APPROVED, resolvedAt: new Date() },
      });
      await this.notifications.notify({
        userId: request.requestedById,
        kind: NotificationKind.VALIDATION_RESULT,
        title: 'Validation obtenue',
        body: request.entityLabel ?? request.kind,
        link: `/validations/${requestId}`,
        metadata: { requestId, kind: request.kind, entityId: request.entityId, result: 'APPROVED' },
      });
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'APPROVAL_STEP_APPROVED',
      entityType: request.kind,
      entityId: request.entityId,
      metadata: { requestId, order: request.currentStepOrder, final: !next },
    });

    if (!next) await this.runCompletion(request, user);

    return this.get(requestId);
  }

  async requestChanges(requestId: string, user: AuthUser, comment: string) {
    if (!comment || comment.trim().length < 3) {
      throw new BadRequestException('Un motif est obligatoire pour demander des corrections');
    }
    const request = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Circuit introuvable');
    if (request.status !== ApprovalStatus.PENDING) throw new BadRequestException('Circuit déjà clos');

    const step = await this.assertCanDecide(requestId, request.currentStepOrder, user);

    await this.prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: ApprovalStepStatus.CHANGES_REQUESTED,
        approverId: user.id,
        comment,
        decidedAt: new Date(),
      },
    });
    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: ApprovalStatus.CHANGES_REQUESTED, resolvedAt: new Date() },
    });

    await this.notifications.notify({
      userId: request.requestedById,
      kind: NotificationKind.VALIDATION_RESULT,
      title: 'Corrections demandées',
      body: comment,
      link: `/validations/${requestId}`,
      metadata: { requestId, kind: request.kind, entityId: request.entityId, result: 'CHANGES_REQUESTED' },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'APPROVAL_CHANGES_REQUESTED',
      entityType: request.kind,
      entityId: request.entityId,
      metadata: { requestId, comment },
    });

    return this.get(requestId);
  }

  async reject(requestId: string, user: AuthUser, comment: string) {
    if (!comment || comment.trim().length < 3) {
      throw new BadRequestException('Le motif de refus est obligatoire');
    }
    const request = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Circuit introuvable');
    if (request.status !== ApprovalStatus.PENDING) throw new BadRequestException('Circuit déjà clos');

    const step = await this.assertCanDecide(requestId, request.currentStepOrder, user);

    await this.prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: ApprovalStepStatus.REJECTED,
        approverId: user.id,
        comment,
        decidedAt: new Date(),
      },
    });
    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: ApprovalStatus.REJECTED, resolvedAt: new Date() },
    });

    await this.notifications.notify({
      userId: request.requestedById,
      kind: NotificationKind.VALIDATION_RESULT,
      title: 'Demande refusée',
      body: comment,
      link: `/validations/${requestId}`,
      metadata: { requestId, kind: request.kind, entityId: request.entityId, result: 'REJECTED' },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'APPROVAL_REJECTED',
      entityType: request.kind,
      entityId: request.entityId,
      metadata: { requestId, comment },
    });

    return this.get(requestId);
  }

  async get(requestId: string) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            approver: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Circuit introuvable');
    return request;
  }

  /** Circuit actif pour une entite donnee. */
  async activeFor(kind: ApprovalKind, entityId: string) {
    return this.prisma.approvalRequest.findFirst({
      where: { kind, entityId, status: ApprovalStatus.PENDING },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async historyFor(kind: ApprovalKind, entityId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { kind, entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { approver: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
    });
  }

  /** File de validation de l utilisateur connecte. */
  async queueFor(user: AuthUser) {
    const requests = await this.prisma.approvalRequest.findMany({
      where: { status: ApprovalStatus.PENDING },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { approver: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return requests.filter((r) => {
      const current = r.steps.find((s) => s.order === r.currentStepOrder);
      if (!current) return false;
      if (current.approverId) return current.approverId === user.id;
      return current.role === user.role;
    });
  }

  /**
   * Delais (section 7.3) : une validation en attente depuis plus de N heures
   * declenche un rappel, puis remonte au niveau superieur.
   */
  async escalateOverdue() {
    const now = new Date();
    const overdue = await this.prisma.approvalStep.findMany({
      where: {
        status: ApprovalStepStatus.PENDING,
        dueAt: { lt: now },
        request: { status: ApprovalStatus.PENDING },
      },
      include: { request: true },
    });

    let escalated = 0;
    for (const step of overdue) {
      if (step.request.currentStepOrder !== step.order) continue;

      const superiors = await this.superiorsFor(step.role);
      await this.prisma.approvalStep.update({
        where: { id: step.id },
        data: { status: ApprovalStepStatus.ESCALATED, decidedAt: now },
      });
      await this.prisma.approvalRequest.update({
        where: { id: step.requestId },
        data: { escalated: true },
      });

      const newStep = await this.prisma.approvalStep.create({
        data: {
          requestId: step.requestId,
          order: step.order + 1,
          role: superiors.role,
          dueAt: new Date(now.getTime() + (await this.settings.escalationHours()) * 3600000),
        },
      });
      await this.prisma.approvalRequest.update({
        where: { id: step.requestId },
        data: { currentStepOrder: newStep.order },
      });
      await this.notifyStep(step.requestId, newStep.order);

      await this.audit.log({
        action: 'APPROVAL_ESCALATED',
        entityType: step.request.kind,
        entityId: step.request.entityId,
        metadata: { requestId: step.requestId, from: step.role, to: superiors.role },
      });
      escalated++;
    }
    return { escalated, checked: overdue.length };
  }

  /** Remontee automatique : si un niveau est vacant, ses taches remontent (section 3). */
  private async superiorsFor(role: Role): Promise<{ role: Role }> {
    const chain: Partial<Record<Role, Role>> = {
      [Role.ORPHANAGE_STAFF]: Role.ORPHANAGE_DIRECTOR,
      [Role.ORPHANAGE_DIRECTOR]: Role.AMBASSADOR,
      [Role.FIELD_AGENT]: Role.REGIONAL_MANAGER,
      [Role.AMBASSADOR]: Role.REGIONAL_MANAGER,
      [Role.REGIONAL_MANAGER]: Role.NATIONAL_MANAGER,
      [Role.NATIONAL_MANAGER]: Role.SUPER_ADMIN,
      [Role.ADMIN_FINANCE]: Role.SUPER_ADMIN,
      [Role.MODERATOR]: Role.SUPER_ADMIN,
    };
    return { role: chain[role] ?? Role.SUPER_ADMIN };
  }
}
