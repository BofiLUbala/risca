import { Injectable } from '@nestjs/common';
import { ChildStatus, DisbursementStatus, ProjectStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../../common/services/scope.service';
import { LedgerService } from '../ledger/ledger.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { TimelineService } from '../children/timeline.service';
import { ChannelsGateway } from '../channels/channels.gateway';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/** Tableaux de bord par acteur (section 11). */
@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private scope: ScopeService,
    private ledger: LedgerService,
    private approvals: ApprovalsService,
    private timeline: TimelineService,
    private gateway: ChannelsGateway,
  ) {}

  async forUser(user: AuthUser) {
    switch (user.role) {
      case Role.SUPER_ADMIN:
        return this.superAdmin(user);
      case Role.ADMIN_FINANCE:
        return this.adminFinance(user);
      case Role.MODERATOR:
        return this.moderator(user);
      case Role.ETHICS_AUDITOR:
        return this.ethicsAuditor(user);
      case Role.NATIONAL_MANAGER:
        return this.nationalManager(user);
      case Role.REGIONAL_MANAGER:
        return this.regionalManager(user);
      case Role.AMBASSADOR:
        return this.ambassador(user);
      case Role.ORPHANAGE_DIRECTOR:
        return this.orphanageDirector(user);
      case Role.ORPHANAGE_STAFF:
        return this.orphanageStaff(user);
      case Role.FIELD_AGENT:
        return this.fieldAgent(user);
      case Role.DONOR:
        return this.donor(user);
      case Role.PARTNER:
        return this.partner(user);
      default:
        return { role: user.role, widgets: [] };
    }
  }

  /** Temps reel : connectes, connexions reussies et echouees, comptes bloques. */
  private async superAdmin(user: AuthUser) {
    const since = new Date(Date.now() - 24 * 3600000);

    const [
      totalUsers,
      activeUsers,
      invitedUsers,
      blockedUsers,
      totalChildren,
      childrenByStatus,
      orphanages,
      labelled,
      loginsOk,
      loginsFailed,
      pendingApprovals,
      openReports,
      openTickets,
      posts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'INVITED' } }),
      this.prisma.user.count({ where: { status: { in: ['BLOCKED', 'SUSPENDED', 'FROZEN'] } } }),
      this.prisma.child.count(),
      this.prisma.child.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.orphanage.count(),
      this.prisma.orphanage.count({
        where: { labelStatus: { in: ['COMPLIANT', 'COMPLIANT_WITH_CONDITIONS'] } },
      }),
      this.prisma.auditLog.count({ where: { action: 'LOGIN_SUCCESS', createdAt: { gte: since } } }),
      this.prisma.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: since } } }),
      this.prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.post.count({ where: { status: 'PUBLISHED' } }),
    ]);

    const money = await this.ledger.summary();

    const usersByCountry = await this.prisma.user.groupBy({
      by: ['countryId'],
      _count: { id: true },
      where: { countryId: { not: null } },
    });
    const countries = await this.prisma.country.findMany({
      select: { id: true, iso2: true, nameFr: true },
    });

    return {
      role: Role.SUPER_ADMIN,
      realtime: {
        onlineNow: this.gateway.onlineCount(),
        loginsLast24h: loginsOk,
        failedLoginsLast24h: loginsFailed,
        blockedAtActivation: invitedUsers,
      },
      users: { total: totalUsers, active: activeUsers, invited: invitedUsers, blocked: blockedUsers },
      children: {
        total: totalChildren,
        byStatus: childrenByStatus.map((c) => ({ status: c.status, count: c._count.id })),
      },
      orphanages: { total: orphanages, labelled, target: 150 },
      money,
      queues: { pendingApprovals, openReports, openTickets },
      posts,
      worldMap: usersByCountry.map((u) => {
        const c = countries.find((x) => x.id === u.countryId);
        return { countryId: u.countryId, iso2: c?.iso2, name: c?.nameFr, users: u._count.id };
      }),
    };
  }

  private async adminFinance(user: AuthUser) {
    const money = await this.ledger.summary();
    const [queue, awaitingReceipts, settled, recentDonations, reconcile] = await Promise.all([
      this.prisma.disbursementRequest.count({ where: { status: DisbursementStatus.AMBASSADOR_CONFIRMED } }),
      this.prisma.disbursementRequest.count({ where: { status: DisbursementStatus.AWAITING_RECEIPTS } }),
      this.prisma.disbursementRequest.count({ where: { status: DisbursementStatus.SETTLED } }),
      this.prisma.donation.findMany({
        where: { status: 'SUCCEEDED' },
        orderBy: { paidAt: 'desc' },
        take: 10,
        include: {
          donor: { select: { firstName: true, lastName: true } },
          child: { select: { firstName: true } },
          project: { select: { title: true } },
        },
      }),
      this.ledger.reconcile(),
    ]);

    const byProvider = await this.prisma.donation.groupBy({
      by: ['provider'],
      where: { status: 'SUCCEEDED' },
      _sum: { amountUsd: true },
      _count: { id: true },
    });

    return {
      role: Role.ADMIN_FINANCE,
      money,
      disbursements: { toApprove: queue, awaitingReceipts, settled },
      recentDonations,
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        total: p._sum.amountUsd ?? 0,
        count: p._count.id,
      })),
      reconciliation: reconcile,
    };
  }

  private async moderator(user: AuthUser) {
    const [openReports, seriousReports, openTickets, hiddenPosts, hiddenMessages] = await Promise.all([
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.report.count({ where: { status: 'OPEN', severity: 'SERIOUS' } }),
      this.prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.post.count({ where: { status: 'HIDDEN' } }),
      this.prisma.message.count({ where: { hidden: true } }),
    ]);

    const recentReports = await this.prisma.report.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      include: { reporter: { select: { firstName: true, lastName: true, role: true } } },
    });

    const ticketsByCategory = await this.prisma.ticket.groupBy({
      by: ['category'],
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      _count: { id: true },
    });

    return {
      role: Role.MODERATOR,
      queues: { openReports, seriousReports, openTickets },
      moderated: { hiddenPosts, hiddenMessages },
      recentReports,
      ticketsByCategory: ticketsByCategory.map((t) => ({ category: t.category, count: t._count.id })),
    };
  }

  /** Lecture seule sur tout : dossiers, projets, flux d argent, journal d audit. */
  private async ethicsAuditor(user: AuthUser) {
    const [seriousReports, frozenProjects, frozenUsers, auditEntries, consentsMissing] = await Promise.all([
      this.prisma.report.count({ where: { severity: 'SERIOUS', status: { in: ['OPEN', 'REVIEWING'] } } }),
      this.prisma.project.count({ where: { status: ProjectStatus.FROZEN } }),
      this.prisma.user.count({ where: { status: 'FROZEN' } }),
      this.prisma.auditLog.count(),
      this.prisma.child.count({ where: { status: 'ACTIVE', consents: { none: { revokedAt: null } } } }),
    ]);

    const money = await this.ledger.summary();
    const reconcile = await this.ledger.reconcile();

    const recentAudit = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { firstName: true, lastName: true, role: true } } },
    });

    const psychoAccess = await this.prisma.auditLog.count({
      where: { action: 'PSYCHO_ACCESSED', createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600000) } },
    });

    return {
      role: Role.ETHICS_AUDITOR,
      governance: { seriousReports, frozenProjects, frozenUsers },
      compliance: { childrenWithoutConsent: consentsMissing, psychoAccessLast30Days: psychoAccess },
      money,
      reconciliation: reconcile,
      auditTrail: { total: auditEntries, recent: recentAudit },
    };
  }

  private async nationalManager(user: AuthUser) {
    const countryId = user.countryId ?? '__none__';

    const [orphanages, labelled, children, regions, regionalManagers, ambassadors] = await Promise.all([
      this.prisma.orphanage.count({ where: { countryId } }),
      this.prisma.orphanage.count({
        where: { countryId, labelStatus: { in: ['COMPLIANT', 'COMPLIANT_WITH_CONDITIONS'] } },
      }),
      this.prisma.child.count({ where: { orphanage: { countryId } } }),
      this.prisma.province.count({ where: { countryId } }),
      this.prisma.user.count({ where: { countryId, role: Role.REGIONAL_MANAGER, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { countryId, role: Role.AMBASSADOR, status: 'ACTIVE' } }),
    ]);

    // « Regions couvertes » = provinces qui ont au moins un chef regional actif,
    // et non le nombre total de provinces du pays.
    const coveredProvinces = await this.prisma.user.findMany({
      where: { countryId, role: Role.REGIONAL_MANAGER, status: 'ACTIVE', provinceId: { not: null } },
      select: { provinceId: true },
      distinct: ['provinceId'],
    });
    const regionsCovered = coveredProvinces.length;

    const byProvince = await this.prisma.orphanage.groupBy({
      by: ['provinceId'],
      where: { countryId },
      _count: { id: true },
    });
    const provinces = await this.prisma.province.findMany({
      where: { countryId },
      select: { id: true, nameFr: true, riskZone: true },
    });

    const fonarev = await this.prisma.child.groupBy({
      by: ['fonarevStatus'],
      where: { orphanage: { countryId }, fonarevStatus: { not: null } },
      _count: { id: true },
    });

    const donations = await this.prisma.donation.aggregate({
      where: { status: 'SUCCEEDED', child: { orphanage: { countryId } } },
      _sum: { amountUsd: true },
      _count: { id: true },
    });

    const disbursed = await this.prisma.disbursementRequest.aggregate({
      where: { status: { in: ['PAID', 'SETTLED'] }, orphanage: { countryId } },
      _sum: { amount: true },
    });

    return {
      role: Role.NATIONAL_MANAGER,
      country: { orphanages, labelled, children, regions, regionsCovered, regionalManagers, ambassadors },
      byProvince: byProvince.map((p) => {
        const prov = provinces.find((x) => x.id === p.provinceId);
        return {
          provinceId: p.provinceId,
          name: prov?.nameFr,
          riskZone: prov?.riskZone,
          orphanages: p._count.id,
        };
      }),
      fonarev: fonarev.map((f) => ({ status: f.fonarevStatus, count: f._count.id })),
      funds: { received: donations._sum.amountUsd ?? 0, disbursed: disbursed._sum.amount ?? 0 },
    };
  }

  private async regionalManager(user: AuthUser) {
    const provinceId = user.provinceId ?? '__none__';

    const [orphanages, children, ambassadors, agents, pendingApprovals] = await Promise.all([
      this.prisma.orphanage.count({ where: { provinceId } }),
      this.prisma.child.count({ where: { orphanage: { provinceId } } }),
      this.prisma.user.count({ where: { provinceId, role: Role.AMBASSADOR, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { provinceId, role: Role.FIELD_AGENT, status: 'ACTIVE' } }),
      this.approvals.queueFor(user),
    ]);

    const overdue = await this.timeline.overdueUpdates(user);
    const nearing = await this.timeline.nearingAdulthood(user);

    const [draft, inValidation, active] = await Promise.all([
      this.prisma.child.count({ where: { orphanage: { provinceId }, status: ChildStatus.DRAFT } }),
      this.prisma.child.count({ where: { orphanage: { provinceId }, status: ChildStatus.IN_VALIDATION } }),
      this.prisma.child.count({ where: { orphanage: { provinceId }, status: ChildStatus.ACTIVE } }),
    ]);
    const completionRate = children > 0 ? Math.round((active / children) * 100) : 0;

    const ambassadorList = await this.prisma.user.findMany({
      where: { provinceId, role: Role.AMBASSADOR, status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        _count: { select: { assignments: true, visitReports: true, posts: true } },
      },
    });

    const audits = await this.prisma.labelAudit.findMany({
      where: { orphanage: { provinceId }, scheduledAt: { gte: new Date() } },
      include: { orphanage: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });

    const transfers = await this.prisma.transfer.findMany({
      where: { status: 'PENDING', child: { orphanage: { provinceId } } },
      include: { child: { select: { id: true, publicId: true, firstName: true } } },
    });

    return {
      role: Role.REGIONAL_MANAGER,
      region: { orphanages, children, ambassadors, agents },
      dossiers: { draft, inValidation, active, completionRate },
      validationQueue: pendingApprovals.length,
      alerts: { overdue: overdue.length, nearingAdulthood: nearing.length },
      overdueDetails: overdue.slice(0, 10),
      nearingAdulthood: nearing.slice(0, 10),
      ambassadorPerformance: ambassadorList,
      scheduledAudits: audits,
      pendingTransfers: transfers,
    };
  }

  /** Mes enfants, file de validation, decaissements, publications. */
  private async ambassador(user: AuthUser) {
    const childIds = await this.scope.assignedChildIds(user.id);
    const ids = childIds.length ? childIds : ['__none__'];

    const [queue, visitReports, posts, disbursementsToConfirm] = await Promise.all([
      this.approvals.queueFor(user),
      this.prisma.visitReport.count({ where: { ambassadorId: user.id } }),
      this.prisma.post.findMany({
        where: { authorId: user.id },
        select: { id: true, viewCount: true, reactionCount: true, commentCount: true },
      }),
      this.prisma.disbursementRequest.count({
        where: { status: DisbursementStatus.REQUESTED, childId: { in: ids } },
      }),
    ]);

    const overdue = await this.timeline.overdueUpdates(user);

    const sponsorships = await this.prisma.sponsorship.count({
      where: { childId: { in: ids }, status: 'ACTIVE' },
    });

    const fundsRaised = await this.prisma.donation.aggregate({
      where: { status: 'SUCCEEDED', childId: { in: ids } },
      _sum: { amountUsd: true },
    });

    const totals = posts.reduce(
      (a, p) => ({
        views: a.views + p.viewCount,
        reactions: a.reactions + p.reactionCount,
        comments: a.comments + p.commentCount,
      }),
      { views: 0, reactions: 0, comments: 0 },
    );

    const fonarev = await this.prisma.child.findMany({
      where: { id: { in: ids }, fonarevStatus: { not: null } },
      select: { id: true, publicId: true, firstName: true, fonarevStatus: true, fonarevFileNumber: true },
    });

    return {
      role: Role.AMBASSADOR,
      myChildren: childIds.length,
      validationQueue: queue.length,
      queueDetails: queue.slice(0, 10),
      disbursementsToConfirm,
      visitReports,
      alerts: overdue,
      publications: { count: posts.length, ...totals },
      sponsoredChildren: sponsorships,
      fundsRaised: fundsRaised._sum.amountUsd ?? 0,
      fonarev,
    };
  }

  private async orphanageDirector(user: AuthUser) {
    const orphanageId = user.orphanageId ?? '__none__';

    const [orphanage, children, draft, inValidation, needsCorrection, staff, projects] =
      await Promise.all([
        this.prisma.orphanage.findUnique({
          where: { id: orphanageId },
          select: {
            id: true,
            name: true,
            labelStatus: true,
            labelExpiresAt: true,
            accountVerified: true,
            totalPlaces: true,
            occupiedPlaces: true,
          },
        }),
        this.prisma.child.count({ where: { orphanageId } }),
        this.prisma.child.count({ where: { orphanageId, status: ChildStatus.DRAFT } }),
        this.prisma.child.count({ where: { orphanageId, status: ChildStatus.IN_VALIDATION } }),
        this.prisma.child.count({ where: { orphanageId, status: ChildStatus.NEEDS_CORRECTION } }),
        this.prisma.user.count({ where: { orphanageId, role: Role.ORPHANAGE_STAFF } }),
        this.prisma.project.count({ where: { orphanageId } }),
      ]);

    const balance = await this.ledger.orphanageBalance(orphanageId);
    const overdue = await this.timeline.overdueUpdates(user);

    const disbursements = await this.prisma.disbursementRequest.findMany({
      where: { orphanageId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { receipts: true },
    });

    const awaitingReceipts = disbursements.filter(
      (d) => d.status === DisbursementStatus.AWAITING_RECEIPTS,
    ).length;

    const transfers = await this.prisma.transfer.findMany({
      where: {
        OR: [{ fromOrphanageId: orphanageId }, { toOrphanageId: orphanageId }],
        status: 'PENDING',
      },
      include: { child: { select: { id: true, publicId: true, firstName: true } } },
    });

    return {
      role: Role.ORPHANAGE_DIRECTOR,
      orphanage,
      children: { total: children, draft, inValidation, needsCorrection },
      staff,
      projects,
      balance,
      disbursements: { recent: disbursements, awaitingReceipts },
      overdueUpdates: overdue.slice(0, 10),
      transfers,
    };
  }

  private async orphanageStaff(user: AuthUser) {
    const orphanageId = user.orphanageId ?? '__none__';
    const children = await this.prisma.child.count({ where: { orphanageId, status: 'ACTIVE' } });

    const base = { role: Role.ORPHANAGE_STAFF, staffFunction: user.staffFunction, children };

    if (user.staffFunction === 'PSYCHOLOGIST') {
      const sessions = await this.prisma.psychoSession.count({ where: { psychologistId: user.id } });
      const withoutAssessment = await this.prisma.child.count({
        where: {
          orphanageId,
          status: 'ACTIVE',
          psychoSessions: { none: { isInitialAssessment: true } },
        },
      });
      return { ...base, sessions, childrenWithoutInitialAssessment: withoutAssessment };
    }

    if (user.staffFunction === 'EDUCATOR') {
      const records = await this.prisma.schoolRecord.count({ where: { recordedById: user.id } });
      const missing = await this.prisma.child.count({
        where: { orphanageId, status: 'ACTIVE', schoolRecords: { none: {} } },
      });
      return { ...base, schoolRecords: records, childrenWithoutRecord: missing };
    }

    const health = await this.prisma.healthRecord.count({ where: { recordedById: user.id } });
    return { ...base, healthRecords: health };
  }

  private async fieldAgent(user: AuthUser) {
    const provinceId = user.provinceId ?? '__none__';
    const [created, orphanages, pending] = await Promise.all([
      this.prisma.child.count({ where: { createdById: user.id } }),
      this.prisma.orphanage.count({ where: { provinceId } }),
      this.prisma.child.count({ where: { createdById: user.id, status: ChildStatus.IN_VALIDATION } }),
    ]);
    return {
      role: Role.FIELD_AGENT,
      childrenRecorded: created,
      pendingValidation: pending,
      orphanagesInRegion: orphanages,
    };
  }

  /** Mon impact : enfants, projets, total donne, preuves de depense. */
  private async donor(user: AuthUser) {
    const donations = await this.prisma.donation.findMany({
      where: { donorId: user.id, status: 'SUCCEEDED' },
      select: { amountUsd: true, childId: true, projectId: true },
    });

    const totalUsd = donations.reduce((s, d) => s + d.amountUsd, 0);
    const childIds = [...new Set(donations.map((d) => d.childId).filter(Boolean))] as string[];
    const projectIds = [...new Set(donations.map((d) => d.projectId).filter(Boolean))] as string[];

    const [sponsorships, subscriptions, favorites] = await Promise.all([
      this.prisma.sponsorship.findMany({
        where: { donorId: user.id, status: 'ACTIVE' },
        include: {
          child: {
            select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true, publicNeeds: true },
          },
        },
      }),
      this.prisma.subscription.count({ where: { userId: user.id } }),
      this.prisma.favorite.count({ where: { userId: user.id } }),
    ]);

    const monthlyCommitment = sponsorships.reduce((s, x) => s + x.monthlyAmount, 0);

    const proofs = projectIds.length
      ? await this.prisma.receipt.count({ where: { disbursement: { projectId: { in: projectIds } } } })
      : 0;

    const recentPosts = childIds.length
      ? await this.prisma.post.findMany({
          where: { childId: { in: childIds }, status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { child: { select: { id: true, firstName: true, publicPhotoUrl: true } } },
        })
      : [];

    return {
      role: Role.DONOR,
      impact: {
        totalDonatedUsd: Number(totalUsd.toFixed(2)),
        donationCount: donations.length,
        childrenSupported: childIds.length,
        projectsSupported: projectIds.length,
        proofsAvailable: proofs,
      },
      sponsorships,
      monthlyCommitment,
      subscriptions,
      favorites,
      feed: recentPosts,
    };
  }

  private async partner(user: AuthUser) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        organizationName: true,
        organizationBio: true,
        organizationLogo: true,
        website: true,
      },
    });

    const donations = await this.prisma.donation.aggregate({
      where: { donorId: user.id, status: 'SUCCEEDED' },
      _sum: { amountUsd: true },
      _count: { id: true },
    });

    const coFunded = await this.prisma.donation.findMany({
      where: { donorId: user.id, status: 'SUCCEEDED', projectId: { not: null } },
      select: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            targetAmount: true,
            collectedAmount: true,
            currency: true,
            orphanage: { select: { name: true, province: { select: { nameFr: true } } } },
          },
        },
      },
    });

    const partners = await this.prisma.user.count({ where: { role: Role.PARTNER, status: 'ACTIVE' } });

    return {
      role: Role.PARTNER,
      profile,
      contribution: { totalUsd: donations._sum.amountUsd ?? 0, count: donations._count.id },
      coFundedProjects: coFunded.map((c) => c.project).filter(Boolean),
      partnersInNetwork: partners,
    };
  }
}
