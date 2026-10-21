import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  ApprovalKind,
  ChildStatus,
  LedgerAccountKind,
  NotificationKind,
  Role,
  TimelineType,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../../common/services/scope.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { SettingsService, SETTING_KEYS } from '../../common/services/settings.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateChildDto, UpdateChildDto } from './dto/child.dto';

@Injectable()
export class ChildrenService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    private approvals: ApprovalsService,
    private settings: SettingsService,
    private notifications: NotificationsService,
  ) {}

  /** Le dernier approbateur active le dossier / applique la modification, sans second geste. */
  onModuleInit() {
    this.approvals.onApproved(ApprovalKind.CHILD_DOSSIER, (req, user) => this.finalizeApproval(req.entityId, user));
    this.approvals.onApproved(ApprovalKind.CHILD_UPDATE, (req, user) => this.applyApprovedUpdate(req.id, user));
  }

  /**
   * Previent la chaine de supervision de la structure qu'un dossier a bouge.
   * Le prenom de l'enfant n'apparait jamais sur un ecran verrouille : la
   * notification est marquee sensible, le detail reste dans l'application.
   */
  private async notifySupervisors(
    orphanageId: string,
    childId: string,
    title: string,
    body: string,
    actorId: string,
  ) {
    const ids = await this.notifications.supervisorsOfOrphanage(orphanageId, actorId);
    if (!ids.length) return;
    await this.notifications.notifyMany(ids, {
      kind: NotificationKind.INFO,
      title,
      body,
      link: `/enfants/${childId}`,
      sensitive: true,
      metadata: { childId, orphanageId },
    });
  }

  private async nextPublicId(countryIso: string): Promise<string> {
    const count = await this.prisma.child.count();
    let n = count + 1;
    for (;;) {
      const candidate = `RISAC-${countryIso}-${String(n).padStart(4, '0')}`;
      const clash = await this.prisma.child.findUnique({ where: { publicId: candidate } });
      if (!clash) return candidate;
      n++;
    }
  }

  /** Detection des doublons (section 2, probleme 5). */
  async findPotentialDuplicates(params: {
    firstName: string;
    lastName: string;
    birthDate?: Date | null;
    orphanageId?: string;
    excludeId?: string;
  }) {
    const or: any[] = [
      {
        firstName: { equals: params.firstName, mode: 'insensitive' },
        lastName: { equals: params.lastName, mode: 'insensitive' },
      },
    ];
    if (params.birthDate) {
      or.push({ birthDate: params.birthDate, lastName: { equals: params.lastName, mode: 'insensitive' } });
    }

    const candidates = await this.prisma.child.findMany({
      where: {
        id: params.excludeId ? { not: params.excludeId } : undefined,
        OR: or,
      },
      select: {
        id: true,
        publicId: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        status: true,
        orphanage: { select: { id: true, name: true } },
      },
      take: 10,
    });

    return candidates.map((c) => {
      let score = 0;
      if (c.firstName.toLowerCase() === params.firstName.toLowerCase()) score += 40;
      if (c.lastName.toLowerCase() === params.lastName.toLowerCase()) score += 40;
      if (params.birthDate && c.birthDate && c.birthDate.getTime() === params.birthDate.getTime()) score += 20;
      if (params.orphanageId && c.orphanage.id === params.orphanageId) score += 10;
      return { ...c, matchScore: Math.min(score, 100) };
    });
  }

  async list(
    user: AuthUser,
    params: { status?: ChildStatus; orphanageId?: string; q?: string; take?: number; skip?: number } = {},
  ) {
    const scopeWhere = await this.scope.childWhere(user);
    const where = {
      AND: [
        scopeWhere,
        params.status ? { status: params.status } : {},
        params.orphanageId ? { orphanageId: params.orphanageId } : {},
        params.q
          ? {
              OR: [
                { firstName: { contains: params.q, mode: 'insensitive' as const } },
                { publicId: { contains: params.q, mode: 'insensitive' as const } },
              ],
            }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.child.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(params.take ?? 50),
        skip: Number(params.skip ?? 0),
        include: {
          orphanage: {
            select: { id: true, name: true, slug: true, province: { select: { nameFr: true } } },
          },
          assignments: {
            where: { active: true },
            include: { ambassador: { select: { id: true, firstName: true, lastName: true } } },
          },
          _count: { select: { timeline: true, projects: true, sponsorships: true } },
        },
      }),
      this.prisma.child.count({ where }),
    ]);

    return { items, total };
  }

  /** Profil public (section 5.4) : jamais de nom de famille ni de localisation precise. */
  async publicProfile(id: string) {
    const child = await this.prisma.child.findFirst({
      where: { id, status: ChildStatus.ACTIVE },
      select: {
        id: true,
        publicId: true,
        firstName: true,
        sex: true,
        birthDate: true,
        estimatedAge: true,
        publicPhotoUrl: true,
        publicStory: true,
        publicNeeds: true,
        lifeProject: true,
        talents: true,
        desiredJob: true,
        warOrphan: true,
        displaced: true,
        orphanage: {
          select: {
            id: true,
            name: true,
            province: { select: { nameFr: true } },
            country: { select: { nameFr: true, iso2: true } },
          },
        },
        schoolRecords: {
          select: { publicSummary: true, year: true, grade: true },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        timeline: {
          where: { isPublic: true },
          orderBy: { occurredAt: 'desc' },
          take: 20,
          select: { id: true, type: true, title: true, description: true, occurredAt: true, attachments: true },
        },
        sponsorships: { where: { status: 'ACTIVE' }, select: { id: true } },
        projects: {
          where: { status: { in: ['PUBLISHED', 'IN_EXECUTION'] } },
          select: { id: true, title: true, targetAmount: true, collectedAmount: true, currency: true },
        },
      },
    });
    if (!child) throw new NotFoundException('Profil introuvable');

    const age = child.birthDate
      ? Math.floor((Date.now() - child.birthDate.getTime()) / (365.25 * 24 * 3600000))
      : child.estimatedAge;

    const { birthDate, sponsorships, ...rest } = child;
    return { ...rest, age, hasSponsor: sponsorships.length > 0, region: child.orphanage.province.nameFr };
  }

  async publicFeed(
    params: {
      countryId?: string;
      provinceId?: string;
      warOrphan?: boolean;
      minAge?: number;
      maxAge?: number;
      needsSponsor?: boolean;
      take?: number;
    } = {},
  ) {
    const children = await this.prisma.child.findMany({
      where: {
        status: ChildStatus.ACTIVE,
        ...(params.warOrphan ? { warOrphan: true } : {}),
        ...(params.countryId ? { orphanage: { countryId: params.countryId } } : {}),
        ...(params.provinceId ? { orphanage: { provinceId: params.provinceId } } : {}),
      },
      take: Number(params.take ?? 40),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        publicId: true,
        firstName: true,
        sex: true,
        birthDate: true,
        estimatedAge: true,
        publicPhotoUrl: true,
        publicStory: true,
        publicNeeds: true,
        warOrphan: true,
        displaced: true,
        orphanage: {
          select: {
            name: true,
            province: { select: { nameFr: true } },
            country: { select: { nameFr: true, iso2: true } },
          },
        },
        sponsorships: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });

    return children
      .map((c) => {
        const age = c.birthDate
          ? Math.floor((Date.now() - c.birthDate.getTime()) / (365.25 * 24 * 3600000))
          : c.estimatedAge;
        const { birthDate, sponsorships, ...rest } = c;
        return { ...rest, age, hasSponsor: sponsorships.length > 0, region: c.orphanage.province.nameFr };
      })
      .filter((c) => {
        if (params.minAge && (c.age ?? 0) < params.minAge) return false;
        if (params.maxAge && (c.age ?? 999) > params.maxAge) return false;
        if (params.needsSponsor && c.hasSponsor) return false;
        return true;
      });
  }

  /** Dossier complet, filtre selon le perimetre et la visibilite (section 5.3). */
  async get(id: string, user: AuthUser) {
    const scopeWhere = await this.scope.childWhere(user);
    const child = await this.prisma.child.findFirst({
      where: { AND: [{ id }, scopeWhere] },
      include: {
        orphanage: {
          select: {
            id: true,
            name: true,
            slug: true,
            labelStatus: true,
            country: { select: { id: true, iso2: true, nameFr: true } },
            province: { select: { id: true, nameFr: true, riskZone: true } },
          },
        },
        assignments: {
          where: { active: true },
          include: { ambassador: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        healthRecords: { orderBy: { recordedAt: 'desc' } },
        schoolRecords: { orderBy: { createdAt: 'desc' } },
        placements: { orderBy: { createdAt: 'desc' } },
        consents: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        transfers: { orderBy: { createdAt: 'desc' } },
        projects: { orderBy: { createdAt: 'desc' } },
        sponsorships: {
          where: { status: 'ACTIVE' },
          select: { id: true, monthlyAmount: true, currency: true, scope: true, startDate: true },
        },
        ledgerAccounts: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        _count: { select: { timeline: true, versions: true } },
      },
    });
    if (!child) throw new NotFoundException('Enfant introuvable ou hors de votre périmètre');

    // Psychotrauma : tres confidentiel
    const canPsycho = await this.scope.canReadPsycho(user, id);
    const psychoSessions = canPsycho
      ? await this.prisma.psychoSession.findMany({ where: { childId: id }, orderBy: { sessionAt: 'desc' } })
      : [];

    // Donnees de sante : masquees pour bailleurs et partenaires
    const confidentialRoles: Role[] = [Role.DONOR, Role.PARTNER];
    const hideConfidential = confidentialRoles.includes(user.role as Role);

    const template = await this.prisma.dossierTemplate.findUnique({
      where: { countryId: child.orphanage.country.id },
      include: { sections: { orderBy: { order: 'asc' }, include: { fields: { orderBy: { order: 'asc' } } } } },
    });

    const result: any = {
      ...child,
      psychoSessions,
      psychoAccessible: canPsycho,
      template,
      pendingApproval: await this.approvals.activeFor(ApprovalKind.CHILD_DOSSIER, id),
      pendingUpdate: await this.approvals.activeFor(ApprovalKind.CHILD_UPDATE, id),
    };

    if (hideConfidential) {
      delete result.lastName;
      delete result.healthRecords;
      delete result.documents;
      delete result.dossierData;
      delete result.placements;
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_DOSSIER_VIEWED',
      entityType: 'Child',
      entityId: id,
      metadata: { psychoAccessed: canPsycho },
    });

    return result;
  }

  /** Verifie les champs obligatoires du modele de dossier du pays (section 5.2). */
  private async validateAgainstTemplate(countryId: string, data: Record<string, unknown>) {
    const template = await this.prisma.dossierTemplate.findUnique({
      where: { countryId },
      include: { sections: { include: { fields: true } } },
    });
    if (!template) return { ok: true, missing: [] as string[] };

    const missing: string[] = [];
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (!field.required) continue;
        const value = (data ?? {})[field.key];
        if (value === undefined || value === null || value === '') {
          missing.push(`${section.labelFr} / ${field.labelFr}`);
        }
      }
    }
    return { ok: missing.length === 0, missing };
  }

  /**
   * Creation (section 5.1) :
   * Chef d orphelinat cree -> Ambassadeur verifie et valide -> Chef regional
   * controle les doublons et valide definitivement (si l option est activee).
   */
  async create(dto: CreateChildDto, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const allowed: Role[] = [Role.ORPHANAGE_DIRECTOR, Role.ORPHANAGE_STAFF, Role.FIELD_AGENT, Role.SUPER_ADMIN];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Seul un chef d’orphelinat, son personnel ou un agent peut créer un dossier');
    }

    const orphanageId = dto.orphanageId ?? user.orphanageId;
    if (!orphanageId) throw new BadRequestException('Orphelinat obligatoire');

    const orphanage = await this.prisma.orphanage.findUnique({
      where: { id: orphanageId },
      include: { country: true, ambassadorLinks: true },
    });
    if (!orphanage) throw new NotFoundException('Orphelinat introuvable');

    if (user.role === Role.ORPHANAGE_DIRECTOR || user.role === Role.ORPHANAGE_STAFF) {
      if (user.orphanageId !== orphanageId) {
        throw new ForbiddenException('Vous ne pouvez créer un dossier que dans votre structure');
      }
    }

    const birthDate = dto.birthDate ? new Date(dto.birthDate) : null;

    const duplicates = await this.findPotentialDuplicates({
      firstName: dto.firstName,
      lastName: dto.lastName,
      birthDate,
      orphanageId,
    });

    const publicId = await this.nextPublicId(orphanage.country.iso2);

    const child = await this.prisma.child.create({
      data: {
        publicId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        sex: dto.sex,
        birthDate,
        estimatedAge: dto.estimatedAge ?? null,
        orphanageId,
        languages: dto.languages ?? [],
        warOrphan: dto.warOrphan ?? false,
        displaced: dto.displaced ?? false,
        abandoned: dto.abandoned ?? false,
        streetChild: dto.streetChild ?? false,
        formerArmedGroup: dto.formerArmedGroup ?? false,
        admittedAt: dto.admittedAt ? new Date(dto.admittedAt) : new Date(),
        admissionReason: dto.admissionReason ?? null,
        referredBy: dto.referredBy ?? null,
        publicStory: dto.publicStory ?? null,
        publicNeeds: dto.publicNeeds ?? null,
        lifeProject: dto.lifeProject ?? null,
        talents: dto.talents ?? null,
        desiredJob: dto.desiredJob ?? null,
        dossierData: (dto.dossierData ?? {}) as any,
        status: ChildStatus.DRAFT,
        createdById: user.id,
      },
    });

    await this.prisma.ledgerAccount.create({
      data: {
        kind: LedgerAccountKind.CHILD,
        label: `Solde ${child.firstName}`,
        childId: child.id,
        currency: 'USD',
      },
    });

    await this.notifySupervisors(
      orphanageId,
      child.id,
      'Nouveau dossier enfant',
      `${child.firstName} a ete enregistre et attend d etre complete puis soumis.`,
      user.id,
    );

    await this.prisma.timelineEvent.create({
      data: {
        childId: child.id,
        type: TimelineType.ADMISSION,
        title: `Admission a ${orphanage.name}`,
        description: dto.admissionReason ?? null,
        occurredAt: child.admittedAt ?? new Date(),
        authorId: user.id,
        visibility: Visibility.CONFIDENTIAL,
      },
    });

    await this.prisma.childVersion.create({
      data: { childId: child.id, version: 1, snapshot: child as any, changedById: user.id, changeNote: 'Creation' },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_CREATED',
      entityType: 'Child',
      entityId: child.id,
      metadata: { publicId, orphanageId, duplicateCandidates: duplicates.length },
    });

    return { child, potentialDuplicates: duplicates };
  }

  /** Soumission du dossier au circuit de validation. */
  async submit(id: string, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const child = await this.prisma.child.findUnique({
      where: { id },
      include: { orphanage: { include: { country: true, ambassadorLinks: true } } },
    });
    if (!child) throw new NotFoundException('Enfant introuvable');

    const submittable: ChildStatus[] = [ChildStatus.DRAFT, ChildStatus.NEEDS_CORRECTION];
    if (!submittable.includes(child.status)) {
      throw new BadRequestException('Ce dossier ne peut pas être soumis dans son état actuel');
    }

    const check = await this.validateAgainstTemplate(child.orphanage.countryId, child.dossierData as any);
    if (!check.ok) {
      throw new BadRequestException(`Champs obligatoires manquants : ${check.missing.join(', ')}`);
    }

    const primary = child.orphanage.ambassadorLinks.find((l) => l.isPrimary) ?? child.orphanage.ambassadorLinks[0];
    if (!primary) {
      throw new BadRequestException('Aucun ambassadeur n’est rattache a cette structure');
    }

    const regionalFinal = Boolean(await this.settings.get(SETTING_KEYS.REGIONAL_FINAL_VALIDATION));

    const steps: Array<{ order: number; role: Role; approverId?: string | null }> = [
      { order: 1, role: Role.AMBASSADOR, approverId: primary.ambassadorId },
    ];
    if (regionalFinal) {
      steps.push({ order: 2, role: Role.REGIONAL_MANAGER, approverId: null });
    }

    const request = await this.approvals.create({
      kind: ApprovalKind.CHILD_DOSSIER,
      entityId: id,
      entityLabel: `Nouveau dossier : ${child.firstName} (${child.publicId})`,
      requestedById: user.id,
      steps,
    });

    const updated = await this.prisma.child.update({
      where: { id },
      data: { status: ChildStatus.IN_VALIDATION },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_SUBMITTED',
      entityType: 'Child',
      entityId: id,
      metadata: { requestId: request.id, regionalFinal },
    });

    return { child: updated, approval: request };
  }

  /** Active le dossier une fois le circuit approuve, et assigne l ambassadeur. */
  async finalizeApproval(id: string, user: AuthUser) {
    const request = await this.approvals.activeFor(ApprovalKind.CHILD_DOSSIER, id);
    if (request) {
      throw new BadRequestException('Le circuit de validation n’est pas termine');
    }

    const history = await this.approvals.historyFor(ApprovalKind.CHILD_DOSSIER, id);
    const last = history[0];
    if (!last || last.status !== 'APPROVED') {
      throw new BadRequestException('Aucun circuit approuve pour ce dossier');
    }

    const child = await this.prisma.child.findUnique({ where: { id } });
    if (!child) throw new NotFoundException('Enfant introuvable');
    if (child.status === ChildStatus.ACTIVE) return child;

    const ambassadorStep = last.steps.find((s) => s.role === Role.AMBASSADOR);
    const ambassadorId = ambassadorStep?.approverId;

    if (ambassadorId) {
      const existing = await this.prisma.childAssignment.findFirst({
        where: { childId: id, ambassadorId, active: true },
      });
      if (!existing) {
        await this.prisma.childAssignment.create({
          data: { childId: id, ambassadorId, active: true, assignedById: user.id },
        });
      }
    }

    const updated = await this.prisma.child.update({
      where: { id },
      data: { status: ChildStatus.ACTIVE },
    });

    await this.prisma.timelineEvent.create({
      data: {
        childId: id,
        type: TimelineType.STATUS_CHANGE,
        title: 'Dossier valide et actif',
        authorId: user.id,
        visibility: Visibility.CONFIDENTIAL,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_ACTIVATED',
      entityType: 'Child',
      entityId: id,
    });

    return updated;
  }

  /**
   * Mise a jour du dossier (section 7.2) :
   * Ambassadeur assigne -> direct. Chef d orphelinat, personnel, agent -> proposition.
   */
  async update(id: string, dto: UpdateChildDto, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const scopeWhere = await this.scope.childWhere(user);
    const child = await this.prisma.child.findFirst({ where: { AND: [{ id }, scopeWhere] } });
    if (!child) throw new NotFoundException('Enfant introuvable ou hors de votre périmètre');

    const { changeNote, orphanageId, ...fields } = dto as any;

    const data: any = { ...fields };
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate);
    if (dto.admittedAt) data.admittedAt = new Date(dto.admittedAt);
    if (dto.dossierData) {
      data.dossierData = { ...((child.dossierData as any) ?? {}), ...dto.dossierData };
    }
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    const directWriters: Role[] = [Role.SUPER_ADMIN, Role.REGIONAL_MANAGER, Role.NATIONAL_MANAGER];
    const isAssignedAmbassador =
      user.role === Role.AMBASSADOR &&
      (await this.prisma.childAssignment.findFirst({
        where: { childId: id, ambassadorId: user.id, active: true },
      })) !== null;

    if (!directWriters.includes(user.role as Role) && !isAssignedAmbassador) {
      const assignment = await this.prisma.childAssignment.findFirst({
        where: { childId: id, active: true },
      });
      if (!assignment) {
        throw new BadRequestException('Aucun ambassadeur assigné pour valider cette proposition');
      }

      const request = await this.approvals.create({
        kind: ApprovalKind.CHILD_UPDATE,
        entityId: id,
        entityLabel: `Mise a jour du dossier de ${child.firstName}`,
        requestedById: user.id,
        steps: [{ order: 1, role: Role.AMBASSADOR, approverId: assignment.ambassadorId }],
        payload: data,
      });

      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'CHILD_UPDATE_PROPOSED',
        entityType: 'Child',
        entityId: id,
        metadata: { requestId: request.id, fields: Object.keys(data) },
      });

      return { applied: false, pendingApproval: request };
    }

    return { applied: true, child: await this.applyUpdate(id, data, user, changeNote) };
  }

  /** Ecrit la mise a jour et cree une nouvelle version (historique non effacable). */
  private async applyUpdate(id: string, data: any, user: AuthUser, changeNote?: string) {
    const before = await this.prisma.child.findUnique({ where: { id } });

    const updated = await this.prisma.child.update({ where: { id }, data });

    const lastVersion = await this.prisma.childVersion.findFirst({
      where: { childId: id },
      orderBy: { version: 'desc' },
    });

    await this.prisma.childVersion.create({
      data: {
        childId: id,
        version: (lastVersion?.version ?? 0) + 1,
        snapshot: updated as any,
        changedById: user.id,
        changeNote: changeNote ?? `Champs modifies : ${Object.keys(data).join(', ')}`,
      },
    });

    const changedKeys = Object.keys(data).filter(
      (k) => JSON.stringify((before as any)[k]) !== JSON.stringify((updated as any)[k]),
    );

    await this.prisma.timelineEvent.create({
      data: {
        childId: id,
        type: TimelineType.DOSSIER_UPDATE,
        title: changeNote ?? 'Mise à jour du dossier',
        description: changedKeys.length ? `Champs : ${changedKeys.join(', ')}` : null,
        authorId: user.id,
        visibility: Visibility.CONFIDENTIAL,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_UPDATED',
      entityType: 'Child',
      entityId: id,
      metadata: { fields: changedKeys },
    });

    return updated;
  }

  /** Applique une proposition de mise a jour validee par l ambassadeur. */
  async applyApprovedUpdate(requestId: string, user: AuthUser) {
    const request = await this.approvals.get(requestId);
    if (request.kind !== ApprovalKind.CHILD_UPDATE) {
      throw new BadRequestException('Ce circuit ne concerne pas une mise à jour de dossier');
    }
    if (request.status !== 'APPROVED') {
      throw new BadRequestException('Ce circuit n’est pas approuve');
    }
    if (await this.approvals.isApplied(requestId)) {
      return this.prisma.child.findUnique({ where: { id: request.entityId } });
    }
    const updated = await this.applyUpdate(request.entityId, (request.payload ?? {}) as any, user, 'Proposition validée');
    await this.approvals.markApplied(requestId, 'Child', request.entityId, user);
    return updated;
  }

  async versions(id: string, user: AuthUser) {
    const scopeWhere = await this.scope.childWhere(user);
    const child = await this.prisma.child.findFirst({ where: { AND: [{ id }, scopeWhere] } });
    if (!child) throw new NotFoundException('Enfant introuvable ou hors de votre périmètre');

    return this.prisma.childVersion.findMany({
      where: { childId: id },
      orderBy: { version: 'desc' },
    });
  }

  /** Comparaison entre deux versions du dossier (section 6.1). */
  async diff(id: string, fromVersion: number, toVersion: number, user: AuthUser) {
    const versions = await this.prisma.childVersion.findMany({
      where: { childId: id, version: { in: [Number(fromVersion), Number(toVersion)] } },
    });
    const a = versions.find((v) => v.version === Number(fromVersion));
    const b = versions.find((v) => v.version === Number(toVersion));
    if (!a || !b) throw new NotFoundException('Version introuvable');

    const sa = a.snapshot as any;
    const sb = b.snapshot as any;
    const keys = new Set([...Object.keys(sa), ...Object.keys(sb)]);
    const changes: Array<{ field: string; before: unknown; after: unknown }> = [];
    for (const k of keys) {
      if (['updatedAt', 'createdAt'].includes(k)) continue;
      if (JSON.stringify(sa[k]) !== JSON.stringify(sb[k])) {
        changes.push({ field: k, before: sa[k], after: sb[k] });
      }
    }
    return { from: a.version, to: b.version, changedBy: b.changedById, changes };
  }

  /** Statuts de l enfant (section 5.5). */
  async changeStatus(id: string, status: ChildStatus, reason: string | undefined, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const allowed: Role[] = [Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER, Role.AMBASSADOR];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Votre rôle ne permet pas de changer le statut d’un enfant');
    }
    await this.scope.assertAmbassadorOwnsChild(user, id);

    const child = await this.prisma.child.findUnique({ where: { id } });
    if (!child) throw new NotFoundException('Enfant introuvable');

    const updated = await this.prisma.child.update({ where: { id }, data: { status } });

    const typeByStatus: Partial<Record<ChildStatus, TimelineType>> = {
      [ChildStatus.REUNIFIED]: TimelineType.REUNIFICATION,
      [ChildStatus.ADULT]: TimelineType.ADULTHOOD,
      [ChildStatus.AFTERCARE]: TimelineType.EXIT,
      [ChildStatus.TRANSFERRED]: TimelineType.TRANSFER,
    };

    await this.prisma.timelineEvent.create({
      data: {
        childId: id,
        type: typeByStatus[status] ?? TimelineType.STATUS_CHANGE,
        title: `Statut : ${child.status} -> ${status}`,
        description: reason ?? null,
        authorId: user.id,
        visibility: Visibility.CONFIDENTIAL,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_STATUS_CHANGED',
      entityType: 'Child',
      entityId: id,
      metadata: { from: child.status, to: status, reason },
    });

    return updated;
  }

  /** Assignation / reassignation d un ambassadeur (Super Admin, section 11). */
  async assignAmbassador(id: string, ambassadorId: string, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const ambassador = await this.prisma.user.findUnique({ where: { id: ambassadorId } });
    if (!ambassador || ambassador.role !== Role.AMBASSADOR) {
      throw new BadRequestException('Ambassadeur introuvable');
    }

    await this.prisma.childAssignment.updateMany({
      where: { childId: id, active: true },
      data: { active: false, unassignedAt: new Date() },
    });

    const assignment = await this.prisma.childAssignment.create({
      data: { childId: id, ambassadorId, active: true, assignedById: user.id },
    });

    await this.prisma.timelineEvent.create({
      data: {
        childId: id,
        type: TimelineType.STATUS_CHANGE,
        title: `Ambassadeur assigne : ${ambassador.firstName} ${ambassador.lastName}`,
        authorId: user.id,
        visibility: Visibility.CONFIDENTIAL,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_ASSIGNED',
      entityType: 'Child',
      entityId: id,
      metadata: { ambassadorId },
    });

    return assignment;
  }

  /** Transfert vers un autre orphelinat : l historique suit l enfant (section 6.1). */
  async requestTransfer(id: string, toOrphanageId: string, reason: string | undefined, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const child = await this.prisma.child.findUnique({ where: { id } });
    if (!child) throw new NotFoundException('Enfant introuvable');
    if (child.orphanageId === toOrphanageId) {
      throw new BadRequestException('L’enfant est déjà dans cette structure');
    }
    const target = await this.prisma.orphanage.findUnique({ where: { id: toOrphanageId } });
    if (!target) throw new NotFoundException('Structure de destination introuvable');

    const transfer = await this.prisma.transfer.create({
      data: {
        childId: id,
        fromOrphanageId: child.orphanageId,
        toOrphanageId,
        reason: reason ?? null,
        status: 'PENDING',
        requestedById: user.id,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_TRANSFER_REQUESTED',
      entityType: 'Child',
      entityId: id,
      metadata: { transferId: transfer.id, toOrphanageId },
    });

    return transfer;
  }

  /** Validation du transfert par le chef regional. */
  async completeTransfer(transferId: string, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const allowed: Role[] = [Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Seul un chef régional ou un administrateur peut valider un transfert');
    }

    const transfer = await this.prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException('Transfert introuvable');
    if (transfer.status !== 'PENDING') throw new BadRequestException('Transfert déjà traité');

    const [from, to] = await Promise.all([
      this.prisma.orphanage.findUnique({ where: { id: transfer.fromOrphanageId } }),
      this.prisma.orphanage.findUnique({ where: { id: transfer.toOrphanageId }, include: { ambassadorLinks: true } }),
    ]);

    await this.prisma.child.update({
      where: { id: transfer.childId },
      data: { orphanageId: transfer.toOrphanageId, status: ChildStatus.ACTIVE },
    });

    // Le nouvel ambassadeur principal reprend le dossier
    const primary = to.ambassadorLinks.find((l) => l.isPrimary) ?? to.ambassadorLinks[0];
    if (primary) {
      await this.prisma.childAssignment.updateMany({
        where: { childId: transfer.childId, active: true },
        data: { active: false, unassignedAt: new Date() },
      });
      await this.prisma.childAssignment.create({
        data: {
          childId: transfer.childId,
          ambassadorId: primary.ambassadorId,
          active: true,
          assignedById: user.id,
        },
      });
    }

    await this.prisma.timelineEvent.create({
      data: {
        childId: transfer.childId,
        type: TimelineType.TRANSFER,
        title: `Transfert : ${from.name} -> ${to.name}`,
        description: transfer.reason ?? null,
        authorId: user.id,
        visibility: Visibility.CONFIDENTIAL,
      },
    });

    const updated = await this.prisma.transfer.update({
      where: { id: transferId },
      data: { status: 'COMPLETED', approvedById: user.id, completedAt: new Date() },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CHILD_TRANSFER_COMPLETED',
      entityType: 'Child',
      entityId: transfer.childId,
      metadata: { transferId, from: from.name, to: to.name },
    });

    return updated;
  }
}
