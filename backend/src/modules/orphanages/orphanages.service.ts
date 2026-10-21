import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  ApprovalKind,
  LabelStatus,
  LedgerAccountKind,
  OrphanageStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../../common/services/scope.service';
import { AuditService } from '../../common/services/audit.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CreateOrphanageDto,
  LabelDecisionDto,
  LinkAmbassadorDto,
  OrphanageHistoryDto,
  UpdateOrphanageDto,
} from './dto/orphanage.dto';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class OrphanagesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    private approvals: ApprovalsService,
  ) {}

  /** La modification de fiche validee est appliquee des la derniere approbation. */
  onModuleInit() {
    this.approvals.onApproved(ApprovalKind.ORPHANAGE_UPDATE, (req, user) => this.applyApprovedUpdate(req.id, user));
  }

  /** Champs publics seulement : la localisation exacte est masquee en zone a risque. */
  private sanitize(orphanage: any, user?: AuthUser) {
    if (!orphanage) return orphanage;
    const privileged =
      user &&
      (this.scope.isGlobal(user.role) ||
        user.role === Role.NATIONAL_MANAGER ||
        user.role === Role.REGIONAL_MANAGER ||
        user.role === Role.AMBASSADOR ||
        user.orphanageId === orphanage.id);

    if (orphanage.hideExactLocation && !privileged) {
      return { ...orphanage, address: null, latitude: null, longitude: null };
    }
    return orphanage;
  }

  async list(user: AuthUser, params: { status?: OrphanageStatus; labelStatus?: LabelStatus; countryId?: string; provinceId?: string; q?: string } = {}) {
    const where = {
      AND: [
        this.scope.orphanageWhere(user),
        params.status ? { status: params.status } : {},
        params.labelStatus ? { labelStatus: params.labelStatus } : {},
        params.countryId ? { countryId: params.countryId } : {},
        params.provinceId ? { provinceId: params.provinceId } : {},
        params.q ? { name: { contains: params.q, mode: 'insensitive' as const } } : {},
      ],
    };

    const items = await this.prisma.orphanage.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        country: { select: { id: true, iso2: true, nameFr: true } },
        province: { select: { id: true, code: true, nameFr: true, riskZone: true } },
        director: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { children: true, projects: true } },
      },
    });

    return items.map((o) => this.sanitize(o, user));
  }

  async publicList(params: { countryId?: string; provinceId?: string } = {}) {
    const items = await this.prisma.orphanage.findMany({
      where: {
        status: OrphanageStatus.APPROVED,
        ...(params.countryId ? { countryId: params.countryId } : {}),
        ...(params.provinceId ? { provinceId: params.provinceId } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        photos: true,
        description: true,
        city: true,
        labelStatus: true,
        totalPlaces: true,
        occupiedPlaces: true,
        urgentNeeds: true,
        country: { select: { iso2: true, nameFr: true } },
        province: { select: { nameFr: true } },
        _count: { select: { children: true } },
      },
    });
    return items;
  }

  async get(id: string, user: AuthUser) {
    const orphanage = await this.prisma.orphanage.findFirst({
      where: { AND: [{ id }, this.scope.orphanageWhere(user)] },
      include: {
        country: true,
        province: true,
        director: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        members: { select: { id: true, firstName: true, lastName: true, role: true, staffFunction: true, email: true } },
        ambassadorLinks: true,
        labelAudits: { orderBy: { createdAt: 'desc' } },
        historyEntries: { orderBy: { occurredAt: 'desc' }, take: 50 },
        ledgerAccounts: true,
        _count: { select: { children: true, projects: true, disbursements: true } },
      },
    });
    if (!orphanage) throw new NotFoundException('Orphelinat introuvable ou hors de votre périmètre');

    const ambassadorIds = orphanage.ambassadorLinks.map((l) => l.ambassadorId);
    const ambassadors = ambassadorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ambassadorIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];

    const approval = await this.approvals.activeFor(ApprovalKind.ORPHANAGE_CREATION, id);

    return {
      ...this.sanitize(orphanage, user),
      ambassadors: orphanage.ambassadorLinks.map((l) => ({
        ...l,
        user: ambassadors.find((a) => a.id === l.ambassadorId) ?? null,
      })),
      pendingApproval: approval,
    };
  }

  /**
   * Creation (section 4) :
   * Chef regional ou Agent propose -> Chef regional verifie -> Super Admin valide.
   */
  async create(dto: CreateOrphanageDto, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const allowed: Role[] = [Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER, Role.FIELD_AGENT];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Seuls un chef regional, un agent ou un administrateur peuvent proposer un orphelinat');
    }

    const province = await this.prisma.province.findUnique({ where: { id: dto.provinceId } });
    if (!province || province.countryId !== dto.countryId) {
      throw new BadRequestException('La province ne correspond pas au pays choisi');
    }

    let slug = slugify(dto.name);
    if (await this.prisma.orphanage.findUnique({ where: { slug } })) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const orphanage = await this.prisma.orphanage.create({
      data: {
        name: dto.name,
        slug,
        countryId: dto.countryId,
        provinceId: dto.provinceId,
        city: dto.city ?? null,
        commune: dto.commune ?? null,
        address: dto.address ?? null,
        description: dto.description ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        legalStatus: dto.legalStatus ?? null,
        licenseNumber: dto.licenseNumber ?? null,
        totalPlaces: dto.totalPlaces ?? 0,
        occupiedPlaces: dto.occupiedPlaces ?? 0,
        hideExactLocation: province.riskZone,
        status: user.role === Role.SUPER_ADMIN ? OrphanageStatus.APPROVED : OrphanageStatus.PROPOSED,
      },
    });

    await this.prisma.ledgerAccount.create({
      data: {
        kind: LedgerAccountKind.ORPHANAGE,
        label: `Solde ${orphanage.name}`,
        orphanageId: orphanage.id,
        currency: 'USD',
      },
    });

    await this.prisma.orphanageHistory.create({
      data: {
        orphanageId: orphanage.id,
        kind: 'STATUS',
        title: 'Structure proposee',
        description: `Proposee par ${user.email}`,
        authorId: user.id,
      },
    });

    if (user.role !== Role.SUPER_ADMIN) {
      const steps =
        user.role === Role.FIELD_AGENT
          ? [
              { order: 1, role: Role.REGIONAL_MANAGER },
              { order: 2, role: Role.SUPER_ADMIN },
            ]
          : [{ order: 1, role: Role.SUPER_ADMIN }];

      await this.approvals.create({
        kind: ApprovalKind.ORPHANAGE_CREATION,
        entityId: orphanage.id,
        entityLabel: `Nouvel orphelinat : ${orphanage.name}`,
        requestedById: user.id,
        steps,
      });
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ORPHANAGE_CREATED',
      entityType: 'Orphanage',
      entityId: orphanage.id,
      metadata: { name: orphanage.name, status: orphanage.status },
    });

    return orphanage;
  }

  /** Validation finale d un orphelinat propose (Super Admin). */
  async approveCreation(id: string, user: AuthUser) {
    const orphanage = await this.prisma.orphanage.findUnique({ where: { id } });
    if (!orphanage) throw new NotFoundException('Orphelinat introuvable');

    const request = await this.approvals.activeFor(ApprovalKind.ORPHANAGE_CREATION, id);
    if (request) await this.approvals.approve(request.id, user);

    const refreshed = await this.approvals.activeFor(ApprovalKind.ORPHANAGE_CREATION, id);
    if (refreshed) {
      return { orphanage, pendingApproval: refreshed };
    }

    const updated = await this.prisma.orphanage.update({
      where: { id },
      data: { status: OrphanageStatus.APPROVED },
    });
    await this.prisma.orphanageHistory.create({
      data: {
        orphanageId: id,
        kind: 'STATUS',
        title: 'Structure validée',
        description: `Validee par ${user.email}`,
        authorId: user.id,
      },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ORPHANAGE_APPROVED',
      entityType: 'Orphanage',
      entityId: id,
    });
    return { orphanage: updated, pendingApproval: null };
  }

  /** Modification de la fiche : Chef d orphelinat -> Chef regional (section 7.2). */
  async update(id: string, dto: UpdateOrphanageDto, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const orphanage = await this.prisma.orphanage.findFirst({
      where: { AND: [{ id }, this.scope.orphanageWhere(user)] },
    });
    if (!orphanage) throw new NotFoundException('Orphelinat introuvable ou hors de votre périmètre');

    const directApply: Role[] = [Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER];

    if (!directApply.includes(user.role as Role)) {
      if (user.role !== Role.ORPHANAGE_DIRECTOR || orphanage.id !== user.orphanageId) {
        throw new ForbiddenException('Vous ne pouvez pas modifier cette fiche');
      }
      const request = await this.approvals.create({
        kind: ApprovalKind.ORPHANAGE_UPDATE,
        entityId: id,
        entityLabel: `Modification de la fiche : ${orphanage.name}`,
        requestedById: user.id,
        steps: [{ order: 1, role: Role.REGIONAL_MANAGER }],
        payload: dto as any,
      });
      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'ORPHANAGE_UPDATE_PROPOSED',
        entityType: 'Orphanage',
        entityId: id,
        metadata: { requestId: request.id },
      });
      return { applied: false, pendingApproval: request };
    }

    const updated = await this.prisma.orphanage.update({ where: { id }, data: dto as any });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ORPHANAGE_UPDATED',
      entityType: 'Orphanage',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return { applied: true, orphanage: updated };
  }

  /** Applique une modification de fiche approuvee par le chef regional. */
  async applyApprovedUpdate(requestId: string, user: AuthUser) {
    const request = await this.approvals.get(requestId);
    if (request.kind !== ApprovalKind.ORPHANAGE_UPDATE) {
      throw new BadRequestException('Ce circuit ne concerne pas une fiche orphelinat');
    }
    if (request.status !== 'APPROVED') {
      throw new BadRequestException('Ce circuit n’est pas approuve');
    }
    if (await this.approvals.isApplied(requestId)) {
      return this.prisma.orphanage.findUnique({ where: { id: request.entityId } });
    }
    const updated = await this.prisma.orphanage.update({
      where: { id: request.entityId },
      data: (request.payload ?? {}) as any,
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ORPHANAGE_UPDATE_APPLIED',
      entityType: 'Orphanage',
      entityId: request.entityId,
      metadata: { requestId },
    });
    await this.approvals.markApplied(requestId, 'Orphanage', request.entityId, user);
    return updated;
  }

  // ---------------------------------------------------------- labellisation

  /** Candidature a la labellisation RISAC (section 4). */
  async applyForLabel(id: string, user: AuthUser) {
    this.scope.assertCanWrite(user);
    const orphanage = await this.prisma.orphanage.findUnique({ where: { id } });
    if (!orphanage) throw new NotFoundException('Orphelinat introuvable');
    if (orphanage.status !== OrphanageStatus.APPROVED) {
      throw new BadRequestException('La structure doit d’abord être validée par le Super Admin');
    }
    if (user.role === Role.ORPHANAGE_DIRECTOR && user.orphanageId !== id) {
      throw new ForbiddenException('Vous ne dirigez pas cette structure');
    }

    const audit = await this.prisma.labelAudit.create({
      data: { orphanageId: id, result: LabelStatus.APPLIED },
    });
    await this.prisma.orphanage.update({ where: { id }, data: { labelStatus: LabelStatus.APPLIED } });

    await this.approvals.create({
      kind: ApprovalKind.LABEL_APPLICATION,
      entityId: id,
      entityLabel: `Labellisation : ${orphanage.name}`,
      requestedById: user.id,
      steps: [
        { order: 1, role: Role.REGIONAL_MANAGER },
        { order: 2, role: Role.SUPER_ADMIN },
      ],
    });

    await this.prisma.orphanageHistory.create({
      data: { orphanageId: id, kind: 'AUDIT', title: 'Candidature a la labellisation', authorId: user.id },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'LABEL_APPLIED',
      entityType: 'Orphanage',
      entityId: id,
      metadata: { auditId: audit.id },
    });
    return audit;
  }

  async scheduleAudit(id: string, scheduledAt: string, user: AuthUser) {
    this.scope.assertCanWrite(user);
    const audit = await this.prisma.labelAudit.create({
      data: {
        orphanageId: id,
        auditorId: user.id,
        scheduledAt: new Date(scheduledAt),
        result: LabelStatus.AUDIT_SCHEDULED,
      },
    });
    await this.prisma.orphanage.update({ where: { id }, data: { labelStatus: LabelStatus.AUDIT_SCHEDULED } });
    await this.prisma.orphanageHistory.create({
      data: {
        orphanageId: id,
        kind: 'AUDIT',
        title: 'Audit planifie',
        description: new Date(scheduledAt).toISOString(),
        authorId: user.id,
      },
    });
    return audit;
  }

  /** Decision d audit : conforme / conforme sous conditions / non conforme. */
  async decideLabel(id: string, dto: LabelDecisionDto, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const valid: LabelStatus[] = [
      LabelStatus.COMPLIANT,
      LabelStatus.COMPLIANT_WITH_CONDITIONS,
      LabelStatus.NON_COMPLIANT,
    ];
    if (!valid.includes(dto.result)) {
      throw new BadRequestException('Resultat d’audit invalide');
    }

    const granted = dto.result !== LabelStatus.NON_COMPLIANT;
    const now = new Date();
    const expires = granted ? new Date(now.getTime() + 2 * 365 * 24 * 3600000) : null;

    const audit = await this.prisma.labelAudit.create({
      data: {
        orphanageId: id,
        auditorId: user.id,
        performedAt: now,
        result: dto.result,
        conditions: dto.conditions ?? null,
        score: dto.score ?? null,
        notes: dto.notes ?? null,
        expiresAt: expires,
      },
    });

    const updated = await this.prisma.orphanage.update({
      where: { id },
      data: {
        labelStatus: dto.result,
        labelGrantedAt: granted ? now : null,
        labelExpiresAt: expires,
      },
    });

    await this.prisma.orphanageHistory.create({
      data: {
        orphanageId: id,
        kind: 'AUDIT',
        title: `Resultat d audit : ${dto.result}`,
        description: dto.conditions ?? dto.notes ?? null,
        authorId: user.id,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'LABEL_DECIDED',
      entityType: 'Orphanage',
      entityId: id,
      metadata: { result: dto.result, auditId: audit.id },
    });

    return { orphanage: updated, audit };
  }

  /** Regle de confiance : seul un orphelinat labellise peut recevoir des fonds. */
  async assertCanReceiveFunds(id: string) {
    const o = await this.prisma.orphanage.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Orphelinat introuvable');

    const labelled: LabelStatus[] = [LabelStatus.COMPLIANT, LabelStatus.COMPLIANT_WITH_CONDITIONS];
    if (!labelled.includes(o.labelStatus)) {
      throw new BadRequestException('Seul un orphelinat labellise peut recevoir des fonds');
    }
    if (o.labelExpiresAt && o.labelExpiresAt < new Date()) {
      throw new BadRequestException('Le label de cette structure a expire, un nouvel audit est requis');
    }
    if (!o.accountVerified) {
      throw new BadRequestException('Le compte de la structure n’est pas vérifié');
    }
    return o;
  }

  async verifyAccount(id: string, verified: boolean, user: AuthUser) {
    const updated = await this.prisma.orphanage.update({
      where: { id },
      data: { accountVerified: verified },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: verified ? 'ORPHANAGE_ACCOUNT_VERIFIED' : 'ORPHANAGE_ACCOUNT_UNVERIFIED',
      entityType: 'Orphanage',
      entityId: id,
    });
    return updated;
  }

  async linkAmbassador(id: string, dto: LinkAmbassadorDto, user: AuthUser) {
    this.scope.assertCanWrite(user);
    const ambassador = await this.prisma.user.findUnique({ where: { id: dto.ambassadorId } });
    if (!ambassador || ambassador.role !== Role.AMBASSADOR) {
      throw new BadRequestException('Utilisateur ambassadeur introuvable');
    }
    if (dto.isPrimary) {
      await this.prisma.orphanageAmbassador.updateMany({
        where: { orphanageId: id },
        data: { isPrimary: false },
      });
    }
    const link = await this.prisma.orphanageAmbassador.upsert({
      where: { orphanageId_ambassadorId: { orphanageId: id, ambassadorId: dto.ambassadorId } },
      update: { isPrimary: dto.isPrimary ?? false },
      create: { orphanageId: id, ambassadorId: dto.ambassadorId, isPrimary: dto.isPrimary ?? false },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ORPHANAGE_AMBASSADOR_LINKED',
      entityType: 'Orphanage',
      entityId: id,
      metadata: { ambassadorId: dto.ambassadorId, isPrimary: dto.isPrimary ?? false },
    });
    return link;
  }

  async unlinkAmbassador(id: string, ambassadorId: string, user: AuthUser) {
    await this.prisma.orphanageAmbassador.deleteMany({ where: { orphanageId: id, ambassadorId } });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ORPHANAGE_AMBASSADOR_UNLINKED',
      entityType: 'Orphanage',
      entityId: id,
      metadata: { ambassadorId },
    });
    return { success: true };
  }

  async addHistory(id: string, dto: OrphanageHistoryDto, user: AuthUser) {
    this.scope.assertCanWrite(user);
    return this.prisma.orphanageHistory.create({
      data: {
        orphanageId: id,
        kind: dto.kind,
        title: dto.title,
        description: dto.description ?? null,
        authorId: user.id,
      },
    });
  }

  async staff(id: string) {
    return this.prisma.user.findMany({
      where: { orphanageId: id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        staffFunction: true,
        status: true,
      },
      orderBy: { lastName: 'asc' },
    });
  }
}
