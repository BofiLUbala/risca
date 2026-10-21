import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, TimelineType, Visibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../../common/services/scope.service';
import { AuditService } from '../../common/services/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ConsentDto,
  HealthRecordDto,
  PsychoSessionDto,
  SchoolRecordDto,
  TimelineEventDto,
  VisitReportDto,
} from './dto/child.dto';

/**
 * Historique et mises a jour de l enfant (section 6).
 * Rien ne peut etre efface : une correction cree une nouvelle entree.
 */
@Injectable()
export class TimelineService {
  constructor(
    private prisma: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
  ) {}

  private async assertReadable(childId: string, user: AuthUser) {
    const ok = await this.scope.canReadChild(user, childId);
    if (!ok) throw new NotFoundException('Enfant introuvable ou hors de votre périmètre');
  }

  async list(childId: string, user: AuthUser, type?: TimelineType) {
    await this.assertReadable(childId, user);

    const canPsycho = await this.scope.canReadPsycho(user, childId);
    const confidentialRoles: Role[] = [Role.DONOR, Role.PARTNER];
    const publicOnly = confidentialRoles.includes(user.role as Role);

    return this.prisma.timelineEvent.findMany({
      where: {
        childId,
        ...(type ? { type } : {}),
        ...(publicOnly ? { isPublic: true } : {}),
        ...(canPsycho ? {} : { type: { not: TimelineType.PSYCHOTRAUMA } }),
      },
      orderBy: { occurredAt: 'desc' },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
  }

  async addEvent(childId: string, dto: TimelineEventDto, user: AuthUser) {
    this.scope.assertCanWrite(user);
    await this.assertReadable(childId, user);

    if (dto.type === TimelineType.PSYCHOTRAUMA) {
      const allowed = await this.scope.canReadPsycho(user, childId);
      if (!allowed) throw new ForbiddenException('Seul le psychologue peut saisir un événement psychotrauma');
    }

    if (dto.correctsId) {
      const original = await this.prisma.timelineEvent.findUnique({ where: { id: dto.correctsId } });
      if (!original || original.childId !== childId) {
        throw new BadRequestException('Événement à corriger introuvable');
      }
    }

    const event = await this.prisma.timelineEvent.create({
      data: {
        childId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        attachments: dto.attachments ?? [],
        isPublic: dto.isPublic ?? false,
        visibility:
          dto.visibility ??
          (dto.type === TimelineType.PSYCHOTRAUMA
            ? Visibility.HIGHLY_CONFIDENTIAL
            : dto.isPublic
              ? Visibility.PUBLIC
              : Visibility.CONFIDENTIAL),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        authorId: user.id,
        correctsId: dto.correctsId ?? null,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: dto.correctsId ? 'TIMELINE_CORRECTED' : 'TIMELINE_EVENT_ADDED',
      entityType: 'Child',
      entityId: childId,
      metadata: { eventId: event.id, type: dto.type },
    });

    return event;
  }

  // ---------------------------------------------------------------- sante

  async addHealth(childId: string, dto: HealthRecordDto, user: AuthUser) {
    this.scope.assertCanWrite(user);
    await this.assertReadable(childId, user);

    const allowed: Role[] = [
      Role.SUPER_ADMIN,
      Role.ORPHANAGE_DIRECTOR,
      Role.ORPHANAGE_STAFF,
      Role.AMBASSADOR,
    ];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Votre rôle ne permet pas de saisir des donnees de santé');
    }

    const record = await this.prisma.healthRecord.create({
      data: { childId, ...dto, recordedById: user.id },
    });

    await this.prisma.timelineEvent.create({
      data: {
        childId,
        type: TimelineType.HEALTH,
        title: dto.consultation ? 'Consultation medicale' : 'Mise à jour du volet santé',
        description: dto.treatments ?? dto.illnesses ?? null,
        authorId: user.id,
        visibility: Visibility.CONFIDENTIAL,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'HEALTH_RECORD_ADDED',
      entityType: 'Child',
      entityId: childId,
      metadata: { recordId: record.id },
    });

    return record;
  }

  // ------------------------------------------------------- psychotrauma

  /** Tres confidentiel : psychologue, ambassadeur assigne, Auditeur Ethique. */
  async addPsychoSession(childId: string, dto: PsychoSessionDto, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const isPsychologist = user.role === Role.ORPHANAGE_STAFF && user.staffFunction === 'PSYCHOLOGIST';
    if (!isPsychologist && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul le psychologue de la structure peut saisir une seance');
    }

    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException('Enfant introuvable');
    if (isPsychologist && child.orphanageId !== user.orphanageId) {
      throw new ForbiddenException('Cet enfant n’est pas dans votre structure');
    }

    const session = await this.prisma.psychoSession.create({
      data: {
        childId,
        isInitialAssessment: dto.isInitialAssessment ?? false,
        evaluation: dto.evaluation ?? null,
        notes: dto.notes ?? null,
        evolution: dto.evolution ?? null,
        psychologistId: user.id,
        sessionAt: dto.sessionAt ? new Date(dto.sessionAt) : new Date(),
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        childId,
        type: TimelineType.PSYCHOTRAUMA,
        title: dto.isInitialAssessment ? 'Evaluation initiale' : 'Seance de suivi',
        authorId: user.id,
        visibility: Visibility.HIGHLY_CONFIDENTIAL,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PSYCHO_SESSION_ADDED',
      entityType: 'Child',
      entityId: childId,
      metadata: { sessionId: session.id },
    });

    return session;
  }

  async psychoSessions(childId: string, user: AuthUser) {
    const allowed = await this.scope.canReadPsycho(user, childId);
    if (!allowed) throw new ForbiddenException('Volet psychotrauma non accessible pour votre rôle');

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PSYCHO_ACCESSED',
      entityType: 'Child',
      entityId: childId,
    });

    return this.prisma.psychoSession.findMany({ where: { childId }, orderBy: { sessionAt: 'desc' } });
  }

  // ---------------------------------------------------------------- scolarite

  async addSchoolRecord(childId: string, dto: SchoolRecordDto, user: AuthUser) {
    this.scope.assertCanWrite(user);
    await this.assertReadable(childId, user);

    const record = await this.prisma.schoolRecord.create({
      data: { childId, ...dto, recordedById: user.id },
    });

    await this.prisma.timelineEvent.create({
      data: {
        childId,
        type: TimelineType.SCHOOLING,
        title: `Bulletin ${dto.term ?? ''} ${dto.year ?? ''}`.trim(),
        description: dto.publicSummary ?? dto.results ?? null,
        isPublic: Boolean(dto.publicSummary),
        visibility: dto.publicSummary ? Visibility.PUBLIC : Visibility.CONFIDENTIAL,
        authorId: user.id,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SCHOOL_RECORD_ADDED',
      entityType: 'Child',
      entityId: childId,
      metadata: { recordId: record.id },
    });

    return record;
  }

  // ---------------------------------------------------------------- consentement

  /** Consentement photo obligatoire avant toute publication (section 8.2). */
  async addConsent(childId: string, dto: ConsentDto, user: AuthUser) {
    this.scope.assertCanWrite(user);
    await this.assertReadable(childId, user);

    const consent = await this.prisma.consent.create({
      data: {
        childId,
        kind: dto.kind ?? 'PHOTO_VIDEO',
        guardianName: dto.guardianName,
        guardianSignedAt: new Date(),
        childSignedAt: dto.childSigned ? new Date() : null,
        documentUrl: dto.documentUrl ?? null,
        witnessId: user.id,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CONSENT_RECORDED',
      entityType: 'Child',
      entityId: childId,
      metadata: { consentId: consent.id, kind: consent.kind },
    });

    return consent;
  }

  async revokeConsent(consentId: string, user: AuthUser) {
    this.scope.assertCanWrite(user);
    const consent = await this.prisma.consent.update({
      where: { id: consentId },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CONSENT_REVOKED',
      entityType: 'Child',
      entityId: consent.childId,
      metadata: { consentId },
    });
    return consent;
  }

  /** Un enfant a-t-il un consentement photo valide ? */
  async hasValidPhotoConsent(childId: string): Promise<boolean> {
    const consent = await this.prisma.consent.findFirst({
      where: { childId, kind: 'PHOTO_VIDEO', revokedAt: null, guardianSignedAt: { not: null } },
    });
    return !!consent;
  }

  // ---------------------------------------------------------------- visites

  /** Rapport de visite de l ambassadeur (au moins une fois par trimestre). */
  async addVisitReport(childId: string, dto: VisitReportDto, user: AuthUser) {
    this.scope.assertCanWrite(user);
    if (user.role !== Role.AMBASSADOR && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul un ambassadeur peut deposer un rapport de visite');
    }
    await this.scope.assertAmbassadorOwnsChild(user, childId);

    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException('Enfant introuvable');

    const report = await this.prisma.visitReport.create({
      data: {
        childId,
        orphanageId: child.orphanageId,
        ambassadorId: user.id,
        note: dto.note,
        rating: dto.rating ?? null,
        photos: dto.photos ?? [],
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      },
    });

    await this.prisma.timelineEvent.create({
      data: {
        childId,
        type: TimelineType.VISIT,
        title: 'Visite de l’ambassadeur',
        description: dto.note,
        attachments: dto.photos ?? [],
        authorId: user.id,
        visibility: Visibility.CONFIDENTIAL,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'VISIT_REPORT_ADDED',
      entityType: 'Child',
      entityId: childId,
      metadata: { reportId: report.id },
    });

    return report;
  }

  // ---------------------------------------------------------------- rappels

  /**
   * Rappels automatiques (section 6.2) :
   * bulletin trimestriel manquant, aucune visite depuis 90 jours.
   * Les retards remontent au chef regional.
   */
  async overdueUpdates(user: AuthUser) {
    const scopeWhere = await this.scope.childWhere(user);
    const children = await this.prisma.child.findMany({
      where: { AND: [{ status: 'ACTIVE' }, scopeWhere] },
      select: {
        id: true,
        publicId: true,
        firstName: true,
        orphanage: { select: { id: true, name: true, provinceId: true } },
        assignments: {
          where: { active: true },
          select: { ambassadorId: true, ambassador: { select: { firstName: true, lastName: true } } },
        },
        visitReports: { orderBy: { visitedAt: 'desc' }, take: 1, select: { visitedAt: true } },
        schoolRecords: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, term: true } },
        timeline: {
          where: { type: 'HEALTH' },
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: { occurredAt: true },
        },
      },
    });

    const now = Date.now();
    const DAY = 24 * 3600000;
    const alerts: any[] = [];

    for (const c of children) {
      const lastVisit = c.visitReports[0]?.visitedAt;
      const lastSchool = c.schoolRecords[0]?.createdAt;

      if (!lastVisit || now - lastVisit.getTime() > 90 * DAY) {
        alerts.push({
          childId: c.id,
          publicId: c.publicId,
          firstName: c.firstName,
          orphanage: c.orphanage.name,
          ambassador: c.assignments[0]?.ambassador ?? null,
          kind: 'VISIT_OVERDUE',
          message: lastVisit
            ? `Aucune visite depuis ${Math.floor((now - lastVisit.getTime()) / DAY)} jours`
            : 'Aucune visite enregistrée à ce jour',
          since: lastVisit ?? null,
        });
      }

      if (!lastSchool || now - lastSchool.getTime() > 120 * DAY) {
        alerts.push({
          childId: c.id,
          publicId: c.publicId,
          firstName: c.firstName,
          orphanage: c.orphanage.name,
          ambassador: c.assignments[0]?.ambassador ?? null,
          kind: 'SCHOOL_RECORD_OVERDUE',
          message: `Le bulletin du trimestre de ${c.firstName} n’a pas été ajouté`,
          since: lastSchool ?? null,
        });
      }
    }

    return alerts;
  }

  /** Enfants proches de 18 ans a preparer pour la post-majorite (section 11). */
  async nearingAdulthood(user: AuthUser) {
    const scopeWhere = await this.scope.childWhere(user);
    const cutoff = new Date(Date.now() - 16 * 365.25 * 24 * 3600000);

    return this.prisma.child.findMany({
      where: {
        AND: [{ status: 'ACTIVE' }, { birthDate: { lte: cutoff } }, scopeWhere],
      },
      select: {
        id: true,
        publicId: true,
        firstName: true,
        birthDate: true,
        postMajorityPrepared: true,
        tremplinScholarship: true,
        mentorName: true,
        orphanage: { select: { id: true, name: true } },
      },
      orderBy: { birthDate: 'asc' },
    });
  }
}
