import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApprovalKind,
  LedgerAccountKind,
  ProjectKind,
  ProjectStatus,
  Role,
  TimelineType,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../../common/services/scope.service';
import { AuditService } from '../../common/services/audit.service';
import { SettingsService } from '../../common/services/settings.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    private approvals: ApprovalsService,
    private settings: SettingsService,
    private ledger: LedgerService,
  ) {}

  /** Contenu d un projet (section 7.3). */
  async create(
    dto: {
      title: string;
      description: string;
      kind?: ProjectKind;
      childId?: string;
      orphanageId?: string;
      targetAmount: number;
      currency?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
      photos?: string[];
      videos?: string[];
    },
    user: AuthUser,
  ) {
    this.scope.assertCanWrite(user);

    const allowed: Role[] = [
      Role.ORPHANAGE_DIRECTOR,
      Role.AMBASSADOR,
      Role.REGIONAL_MANAGER,
      Role.SUPER_ADMIN,
    ];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Votre rôle ne permet pas de créer un projet');
    }
    if (dto.targetAmount <= 0) throw new BadRequestException('Le montant visé doit être positif');

    let orphanageId = dto.orphanageId ?? user.orphanageId ?? null;

    if (dto.childId) {
      const child = await this.prisma.child.findUnique({ where: { id: dto.childId } });
      if (!child) throw new NotFoundException('Enfant introuvable');
      if (child.status !== 'ACTIVE') {
        throw new BadRequestException('Le dossier de cet enfant doit être actif');
      }
      orphanageId = child.orphanageId;

      if (user.role === Role.ORPHANAGE_DIRECTOR && user.orphanageId !== child.orphanageId) {
        throw new ForbiddenException('Cet enfant n’est pas dans votre structure');
      }
      if (user.role === Role.AMBASSADOR) {
        await this.scope.assertAmbassadorOwnsChild(user, dto.childId);
      }
    }

    const kind = dto.kind ?? (dto.childId ? ProjectKind.CHILD_PROJECT : ProjectKind.ORPHANAGE_PROJECT);

    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        description: dto.description,
        kind,
        status: ProjectStatus.DRAFT,
        category: dto.category ?? null,
        childId: dto.childId ?? null,
        orphanageId,
        targetAmount: dto.targetAmount,
        currency: (dto.currency ?? 'USD').toUpperCase(),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        photos: dto.photos ?? [],
        videos: dto.videos ?? [],
        createdById: user.id,
      },
    });

    await this.ledger.accountFor(
      LedgerAccountKind.PROJECT,
      { projectId: project.id },
      `Projet ${project.title}`,
    );

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project.id,
      metadata: { title: project.title, targetAmount: project.targetAmount, kind },
    });

    return project;
  }

  /**
   * Soumission au circuit (section 7.1) :
   * Chef d orphelinat -> ambassadeur de l enfant -> chef regional si montant > seuil.
   * L ambassadeur auquel l enfant est assigne doit obligatoirement valider.
   */
  async submit(id: string, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { orphanage: { include: { ambassadorLinks: true } } },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    const submittable: ProjectStatus[] = [
      ProjectStatus.DRAFT,
      ProjectStatus.NEEDS_CORRECTION,
      ProjectStatus.REJECTED,
    ];
    if (!submittable.includes(project.status)) {
      throw new BadRequestException('Ce projet ne peut pas être soumis dans son état actuel');
    }

    const threshold = await this.settings.projectThreshold();
    const steps: Array<{ order: number; role: Role; approverId?: string | null }> = [];

    if (project.childId) {
      // Projet d un enfant : l ambassadeur assigne valide obligatoirement
      const assignment = await this.prisma.childAssignment.findFirst({
        where: { childId: project.childId, active: true },
      });
      if (!assignment) {
        throw new BadRequestException('Aucun ambassadeur assigné a cet enfant');
      }
      steps.push({ order: 1, role: Role.AMBASSADOR, approverId: assignment.ambassadorId });
    } else if (user.role === Role.AMBASSADOR) {
      // Projet cree par l ambassadeur : va directement au chef regional
      steps.push({ order: 1, role: Role.REGIONAL_MANAGER, approverId: null });
    } else {
      // Projet d orphelinat : ambassadeur principal
      const primary =
        project.orphanage?.ambassadorLinks.find((l) => l.isPrimary) ??
        project.orphanage?.ambassadorLinks[0];
      if (!primary) throw new BadRequestException('Aucun ambassadeur principal rattache a la structure');
      steps.push({ order: 1, role: Role.AMBASSADOR, approverId: primary.ambassadorId });
    }

    // Validation finale du chef regional au-dessus du seuil
    const needsRegional = project.targetAmount > threshold;
    if (needsRegional && steps[0].role !== Role.REGIONAL_MANAGER) {
      steps.push({ order: 2, role: Role.REGIONAL_MANAGER, approverId: null });
    }

    const request = await this.approvals.create({
      kind: ApprovalKind.PROJECT,
      entityId: id,
      entityLabel: `Projet : ${project.title} (${project.targetAmount} ${project.currency})`,
      requestedById: user.id,
      steps,
    });

    const updated = await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.IN_VALIDATION },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROJECT_SUBMITTED',
      entityType: 'Project',
      entityId: id,
      metadata: { requestId: request.id, threshold, needsRegional },
    });

    return { project: updated, approval: request };
  }

  /** Publication une fois le circuit approuve. */
  async publish(id: string, user: AuthUser) {
    const pending = await this.approvals.activeFor(ApprovalKind.PROJECT, id);
    if (pending) throw new BadRequestException('Le circuit de validation n’est pas termine');

    const history = await this.approvals.historyFor(ApprovalKind.PROJECT, id);
    if (!history[0] || history[0].status !== 'APPROVED') {
      throw new BadRequestException('Aucun circuit approuve pour ce projet');
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.PUBLISHED, publishedAt: new Date() },
    });

    if (project.childId) {
      await this.prisma.timelineEvent.create({
        data: {
          childId: project.childId,
          type: TimelineType.PROJECT,
          title: `Projet publie : ${project.title}`,
          description: `Objectif : ${project.targetAmount} ${project.currency}`,
          isPublic: true,
          visibility: Visibility.PUBLIC,
          authorId: user.id,
        },
      });
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROJECT_PUBLISHED',
      entityType: 'Project',
      entityId: id,
    });

    return project;
  }

  /** Statuts (section 7.3). */
  async changeStatus(id: string, status: ProjectStatus, reason: string | undefined, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Projet introuvable');

    if (status === ProjectStatus.CANCELLED && !reason) {
      throw new BadRequestException('Un motif est obligatoire pour annuler un projet');
    }
    if (status === ProjectStatus.COMPLETED) {
      const milestones = await this.prisma.projectMilestone.count({ where: { projectId: id } });
      if (milestones === 0) {
        throw new BadRequestException('Un rapport final avec preuves est requis avant de terminer le projet');
      }
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        status,
        ...(status === ProjectStatus.REJECTED || status === ProjectStatus.CANCELLED
          ? { rejectionReason: reason ?? null }
          : {}),
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROJECT_STATUS_CHANGED',
      entityType: 'Project',
      entityId: id,
      metadata: { from: project.status, to: status, reason },
    });

    return updated;
  }

  /** Gel d un projet par l Auditeur Ethique (section 11, HCETDE). */
  async freeze(id: string, reason: string, user: AuthUser) {
    if (user.role !== Role.ETHICS_AUDITOR && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul l’Auditeur Éthique ou le Super Admin peut geler un projet');
    }
    if (!reason) throw new BadRequestException('Un motif est obligatoire');

    const project = await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.FROZEN, frozenReason: reason },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: 'ACTIVE' },
      select: { id: true },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROJECT_FROZEN',
      entityType: 'Project',
      entityId: id,
      metadata: { reason, notified: admins.length },
    });

    return project;
  }

  async addMilestone(
    id: string,
    dto: { title: string; description?: string; photos?: string[]; videos?: string[]; completed?: boolean },
    user: AuthUser,
  ) {
    this.scope.assertCanWrite(user);
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Projet introuvable');

    const milestone = await this.prisma.projectMilestone.create({
      data: {
        projectId: id,
        title: dto.title,
        description: dto.description ?? null,
        photos: dto.photos ?? [],
        videos: dto.videos ?? [],
        completedAt: dto.completed ? new Date() : null,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROJECT_MILESTONE_ADDED',
      entityType: 'Project',
      entityId: id,
      metadata: { milestoneId: milestone.id },
    });

    return milestone;
  }

  async update(id: string, dto: any, user: AuthUser) {
    this.scope.assertCanWrite(user);
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Projet introuvable');

    const editable: ProjectStatus[] = [
      ProjectStatus.DRAFT,
      ProjectStatus.NEEDS_CORRECTION,
      ProjectStatus.REJECTED,
    ];
    if (!editable.includes(project.status) && user.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException('Un projet publié ne peut plus être modifié librement');
    }

    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    delete data.childId;
    delete data.status;

    const updated = await this.prisma.project.update({ where: { id }, data });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROJECT_UPDATED',
      entityType: 'Project',
      entityId: id,
      metadata: { fields: Object.keys(data) },
    });
    return updated;
  }

  // -------------------------------------------------------------- lecture

  async list(
    user: AuthUser,
    params: { status?: ProjectStatus; childId?: string; orphanageId?: string; kind?: ProjectKind } = {},
  ) {
    const scoped: any[] = [
      params.status ? { status: params.status } : {},
      params.childId ? { childId: params.childId } : {},
      params.orphanageId ? { orphanageId: params.orphanageId } : {},
      params.kind ? { kind: params.kind } : {},
    ];

    if (user.role === Role.ORPHANAGE_DIRECTOR || user.role === Role.ORPHANAGE_STAFF) {
      scoped.push({ orphanageId: user.orphanageId ?? '__none__' });
    } else if (user.role === Role.AMBASSADOR) {
      const childIds = await this.scope.assignedChildIds(user.id);
      const orphanageIds = await this.scope.ambassadorOrphanageIds(user.id);
      scoped.push({
        OR: [
          { childId: { in: childIds.length ? childIds : ['__none__'] } },
          { orphanageId: { in: orphanageIds.length ? orphanageIds : ['__none__'] } },
          { createdById: user.id },
        ],
      });
    } else if (user.role === Role.REGIONAL_MANAGER) {
      scoped.push({ orphanage: { provinceId: user.provinceId ?? '__none__' } });
    } else if (user.role === Role.NATIONAL_MANAGER) {
      scoped.push({ orphanage: { countryId: user.countryId ?? '__none__' } });
    } else if (user.role === Role.DONOR || user.role === Role.PARTNER) {
      scoped.push({ status: { in: [ProjectStatus.PUBLISHED, ProjectStatus.IN_EXECUTION, ProjectStatus.FULLY_FUNDED] } });
    }

    return this.prisma.project.findMany({
      where: { AND: scoped },
      orderBy: { createdAt: 'desc' },
      include: {
        child: { select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true } },
        orphanage: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        _count: { select: { donations: true, milestones: true } },
      },
    });
  }

  /** Projets publies, visibles dans l espace de communication. */
  async publicList(params: { category?: string; countryId?: string; take?: number } = {}) {
    return this.prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.PUBLISHED, ProjectStatus.IN_EXECUTION, ProjectStatus.FULLY_FUNDED] },
        ...(params.category ? { category: params.category } : {}),
        ...(params.countryId ? { orphanage: { countryId: params.countryId } } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: Number(params.take ?? 40),
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        status: true,
        category: true,
        targetAmount: true,
        collectedAmount: true,
        currency: true,
        photos: true,
        videos: true,
        endDate: true,
        publishedAt: true,
        child: { select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true } },
        orphanage: { select: { id: true, name: true, province: { select: { nameFr: true } } } },
        _count: { select: { donations: true } },
      },
    });
  }

  async get(id: string, user?: AuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        child: { select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true, publicStory: true } },
        orphanage: { select: { id: true, name: true, labelStatus: true, province: { select: { nameFr: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        milestones: { orderBy: { createdAt: 'asc' } },
        _count: { select: { donations: true } },
      },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    const donorCount = await this.prisma.donation.groupBy({
      by: ['donorId'],
      where: { projectId: id, status: 'SUCCEEDED' },
    });

    const approval = await this.approvals.activeFor(ApprovalKind.PROJECT, id);
    const balance = await this.ledger.projectBalance(id);

    const progress =
      project.targetAmount > 0
        ? Math.min(100, Math.round((project.collectedAmount / project.targetAmount) * 100))
        : 0;

    return { ...project, donorCount: donorCount.length, progress, balance, pendingApproval: approval };
  }
}
