import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChildStatus, NotificationKind, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const person = { select: { id: true, firstName: true, lastName: true, role: true, adminRank: true } } as const;
const include = { user: { select: { id: true, firstName: true, lastName: true, role: true, provinceId: true, countryId: true } }, grantedBy: person, handedOverTo: person, handedOverBy: person } as const;

type Transition = Awaited<ReturnType<TransitionsService['load']>>;

/**
 * Reprise de l'ancien espace après une promotion. Deux conditions pour que la personne promue puisse cloner ses
 * données : avoir été promue, et que son chef régional ou national (ou un Super Admin) lui en ait donné l'accord.
 * Le clone est une copie en lecture seule de ce qu'elle avait fait : il ne lui rend pas l'accès aux dossiers de
 * l'ancien rôle. Les responsabilités encore actives se confient à un autre agent (transfert).
 */
@Injectable()
export class TransitionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private state(t: { grantedAt: Date | null; clonedAt: Date | null }) {
    return t.clonedAt ? 'CLONED' : t.grantedAt ? 'GRANTED' : 'WAITING';
  }

  private shape(t: Transition) {
    return {
      id: t.id,
      user: t.user,
      fromRole: t.fromRole,
      toRole: t.toRole,
      promotedAt: t.promotedAt,
      grantedAt: t.grantedAt,
      grantedBy: t.grantedBy,
      clonedAt: t.clonedAt,
      handedOverAt: t.handedOverAt,
      handedOverTo: t.handedOverTo,
      handedOverBy: t.handedOverBy,
      handoverSummary: t.handoverSummary,
      state: this.state(t),
    };
  }

  /** Les superviseurs agissent dans leur périmètre : chef régional sur sa province, responsable national sur son pays. */
  private canSupervise(actor: AuthUser, subject: { provinceId: string | null; countryId: string | null }) {
    if (actor.role === Role.SUPER_ADMIN) return true;
    if (actor.role === Role.REGIONAL_MANAGER) return !!actor.provinceId && subject.provinceId === actor.provinceId;
    if (actor.role === Role.NATIONAL_MANAGER) return !!actor.countryId && subject.countryId === actor.countryId;
    return false;
  }

  private async load(id: string) {
    const t = await this.prisma.roleTransition.findUnique({ where: { id }, include });
    if (!t) throw new NotFoundException('Transition introuvable');
    return t;
  }

  /** Ma dernière transition (la personne promue). Aucune : pas de promotion à reprendre. */
  async mine(user: AuthUser) {
    const t = await this.prisma.roleTransition.findFirst({ where: { userId: user.id }, orderBy: { promotedAt: 'desc' }, include });
    return t ? this.shape(t) : null;
  }

  /** Les promotions de mon périmètre, à traiter (accord, transfert). */
  async list(user: AuthUser) {
    if (![Role.REGIONAL_MANAGER, Role.NATIONAL_MANAGER, Role.SUPER_ADMIN].includes(user.role as any)) {
      throw new ForbiddenException('Réservé au chef régional, au responsable national et aux Super Admin');
    }
    const scope =
      user.role === Role.REGIONAL_MANAGER
        ? { user: { provinceId: user.provinceId ?? '__none__' } }
        : user.role === Role.NATIONAL_MANAGER
          ? { user: { countryId: user.countryId ?? '__none__' } }
          : {};
    const rows = await this.prisma.roleTransition.findMany({ where: scope, orderBy: { promotedAt: 'desc' }, take: 100, include });
    return rows.map((t) => this.shape(t));
  }

  /** Accord : la personne promue peut désormais cloner les données de son ancien espace. */
  async grant(id: string, actor: AuthUser) {
    const t = await this.load(id);
    if (!this.canSupervise(actor, t.user)) throw new ForbiddenException('Cette personne n’est pas dans votre périmètre');
    if (t.user.id === actor.id) throw new ForbiddenException('Vous ne pouvez pas vous donner l’accord vous-même');
    if (t.grantedAt) throw new BadRequestException('L’accord est déjà donné');
    const updated = await this.prisma.roleTransition.update({ where: { id }, data: { grantedAt: new Date(), grantedById: actor.id }, include });
    await this.log(actor, 'TRANSITION_ACCESS_GRANTED', id, { userId: t.user.id });
    await this.notifications.notify({
      userId: t.user.id,
      kind: NotificationKind.INFO,
      title: 'Vous pouvez reprendre vos données',
      body: 'Votre responsable a donné son accord : vous pouvez cloner les données de votre ancien espace.',
      link: '/tableau-de-bord',
      metadata: { transitionId: id },
    });
    return this.shape(updated);
  }

  /** La personne promue clone son ancien espace : une copie en lecture seule, rangée dans sa fiche de transition. */
  async clone(id: string, user: AuthUser) {
    const t = await this.load(id);
    if (t.user.id !== user.id) throw new ForbiddenException('Seule la personne promue peut cloner ses données');
    if (!t.grantedAt) throw new ForbiddenException('Votre chef régional ou national doit d’abord donner son accord');
    if (t.clonedAt) return this.shape(t);
    const snapshot = await this.buildSnapshot(user.id, t.fromRole);
    const updated = await this.prisma.roleTransition.update({ where: { id }, data: { clonedAt: new Date(), snapshot: snapshot as any }, include });
    await this.log(user, 'TRANSITION_DATA_CLONED', id, { fromRole: t.fromRole, counts: snapshot.counts });
    return this.shape(updated);
  }

  /** L'ancien espace cloné (lecture seule). Visible de la personne promue et de ses superviseurs. */
  async archive(id: string, user: AuthUser) {
    const t = await this.load(id);
    if (t.user.id !== user.id && !this.canSupervise(user, t.user)) throw new ForbiddenException('Accès refusé');
    if (!t.clonedAt || !t.snapshot) throw new NotFoundException('Les données n’ont pas encore été clonées');
    return { ...this.shape(t), snapshot: t.snapshot };
  }

  /**
   * Transfert : les responsabilités et tâches en cours de l'ancien rôle passent à un autre agent du même rôle et de la
   * même province. Réservé au chef régional, au responsable national ou à un Super Admin.
   */
  async handover(id: string, toUserId: string, actor: AuthUser) {
    const t = await this.load(id);
    if (!this.canSupervise(actor, t.user)) throw new ForbiddenException('Cette personne n’est pas dans votre périmètre');
    if (t.handedOverAt) throw new BadRequestException('Les responsabilités ont déjà été transférées');
    const target = await this.prisma.user.findUnique({ where: { id: toUserId } });
    if (!target || target.status !== UserStatus.ACTIVE) throw new NotFoundException('Agent introuvable ou inactif');
    if (target.id === t.user.id) throw new BadRequestException('Choisissez un autre agent');
    if (target.role !== t.fromRole || target.provinceId !== t.user.provinceId) {
      throw new BadRequestException('Le destinataire doit avoir l’ancien rôle et être dans la même province');
    }

    const from = t.user.id;
    const pendingChild = { in: [ChildStatus.DRAFT, ChildStatus.NEEDS_CORRECTION, ChildStatus.IN_VALIDATION] };

    // Les liens d'orphelinat que le destinataire a déjà ne sont pas dupliqués.
    const existingLinks = await this.prisma.orphanageAmbassador.findMany({ where: { ambassadorId: target.id }, select: { orphanageId: true } });
    const have = new Set(existingLinks.map((l) => l.orphanageId));
    const links = await this.prisma.orphanageAmbassador.findMany({ where: { ambassadorId: from }, select: { id: true, orphanageId: true } });
    const moveLinks = links.filter((l) => !have.has(l.orphanageId)).map((l) => l.id);

    const [assignments, orphanageLinks, children, proposals] = await this.prisma.$transaction([
      this.prisma.childAssignment.updateMany({ where: { ambassadorId: from, active: true }, data: { ambassadorId: target.id } }),
      this.prisma.orphanageAmbassador.updateMany({ where: { id: { in: moveLinks } }, data: { ambassadorId: target.id } }),
      this.prisma.child.updateMany({ where: { createdById: from, status: pendingChild }, data: { createdById: target.id } }),
      this.prisma.orphanage.updateMany({ where: { proposedById: from, status: 'PROPOSED' as any }, data: { proposedById: target.id } }),
    ]);
    const summary = { assignments: assignments.count, orphanageLinks: orphanageLinks.count, childRecordsInProgress: children.count, orphanageProposals: proposals.count };
    const updated = await this.prisma.roleTransition.update({
      where: { id },
      data: { handedOverToId: target.id, handedOverById: actor.id, handedOverAt: new Date(), handoverSummary: summary },
      include,
    });
    await this.log(actor, 'TRANSITION_HANDOVER', id, { from, to: target.id, ...summary });
    await this.notifications.notify({
      userId: target.id,
      kind: NotificationKind.INFO,
      title: 'Responsabilités reçues',
      body: `${t.user.firstName} ${t.user.lastName} vous confie ses responsabilités et ses tâches en cours.`,
      link: '/tableau-de-bord',
      metadata: { transitionId: id },
    });
    return this.shape(updated);
  }

  /**
   * Copie de l'ancien espace, quel que soit l'ancien rôle : ce que la personne a publié (photos comprises), ses
   * responsabilités, son historique et ses tâches. Les noms d'enfants n'y figurent pas : on garde l'identifiant public.
   */
  private async buildSnapshot(userId: string, fromRole: Role) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, avatarUrl: true, province: { select: { nameFr: true } }, country: { select: { nameFr: true } } },
    });
    const [posts, assignments, links, children, proposals, visits, timeline, orphHistory, requests, decisions, audit] = await Promise.all([
      this.prisma.post.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, content: true, photos: true, createdAt: true } }),
      this.prisma.childAssignment.findMany({ where: { ambassadorId: userId, active: true }, include: { child: { select: { publicId: true, orphanage: { select: { name: true } } } } } }),
      this.prisma.orphanageAmbassador.findMany({ where: { ambassadorId: userId }, select: { orphanageId: true, createdAt: true } }),
      this.prisma.child.findMany({ where: { createdById: userId }, orderBy: { createdAt: 'desc' }, take: 100, select: { publicId: true, status: true, createdAt: true, orphanage: { select: { name: true } } } }),
      this.prisma.orphanage.findMany({ where: { proposedById: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { name: true, status: true, createdAt: true } }),
      this.prisma.visitReport.findMany({ where: { ambassadorId: userId }, orderBy: { visitedAt: 'desc' }, take: 100, select: { visitedAt: true, photos: true, child: { select: { publicId: true } } } }),
      this.prisma.timelineEvent.findMany({ where: { authorId: userId }, orderBy: { occurredAt: 'desc' }, take: 100, select: { title: true, occurredAt: true, child: { select: { publicId: true } } } }),
      this.prisma.orphanageHistory.findMany({ where: { authorId: userId }, orderBy: { occurredAt: 'desc' }, take: 50, select: { title: true, occurredAt: true, orphanage: { select: { name: true } } } }),
      this.prisma.approvalRequest.findMany({ where: { requestedById: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { entityLabel: true, kind: true, status: true, createdAt: true } }),
      this.prisma.approvalStep.count({ where: { approverId: userId } }),
      this.prisma.auditLog.findMany({ where: { actorId: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { action: true, entityType: true, createdAt: true } }),
    ]);
    const orphNames = links.length
      ? new Map((await this.prisma.orphanage.findMany({ where: { id: { in: links.map((l) => l.orphanageId) } }, select: { id: true, name: true } })).map((o) => [o.id, o.name]))
      : new Map<string, string>();

    const inProgress: ChildStatus[] = [ChildStatus.DRAFT, ChildStatus.NEEDS_CORRECTION, ChildStatus.IN_VALIDATION];
    const openTasks = {
      requestsPending: requests.filter((r) => r.status === 'PENDING').length,
      childRecordsInProgress: children.filter((c) => inProgress.includes(c.status)).length,
      orphanageProposalsPending: proposals.filter((o) => (o.status as string) === 'PROPOSED').length,
    };
    return {
      takenAt: new Date().toISOString(),
      fromRole,
      profile: { name: `${me?.firstName ?? ''} ${me?.lastName ?? ''}`.trim(), avatarUrl: me?.avatarUrl ?? null, province: me?.province?.nameFr ?? null, country: me?.country?.nameFr ?? null },
      responsibilities: {
        childAssignments: assignments.map((a) => ({ childPublicId: a.child.publicId, orphanage: a.child.orphanage?.name ?? null, since: a.assignedAt })),
        orphanages: links.map((l) => ({ name: orphNames.get(l.orphanageId) ?? '—', since: l.createdAt })),
      },
      tasks: { open: openTasks, requests: requests.map((r) => ({ label: r.entityLabel ?? r.kind, status: r.status, at: r.createdAt })) },
      history: {
        childrenRecorded: children.map((c) => ({ publicId: c.publicId, status: c.status, orphanage: c.orphanage?.name ?? null, at: c.createdAt })),
        orphanagesProposed: proposals.map((o) => ({ name: o.name, status: o.status, at: o.createdAt })),
        visits: visits.map((v) => ({ at: v.visitedAt, childPublicId: v.child?.publicId ?? null, photos: v.photos })),
        childTimeline: timeline.map((e) => ({ title: e.title, at: e.occurredAt, childPublicId: e.child?.publicId ?? null })),
        orphanageHistory: orphHistory.map((h) => ({ title: h.title, at: h.occurredAt, orphanage: h.orphanage?.name ?? null })),
        decisionsTaken: decisions,
        recentActions: audit.map((a) => ({ action: a.action, entity: a.entityType, at: a.createdAt })),
      },
      photos: [...posts.flatMap((p) => p.photos), ...visits.flatMap((v) => v.photos)].slice(0, 60),
      posts: posts.map((p) => ({ id: p.id, content: p.content.slice(0, 300), photos: p.photos, at: p.createdAt })),
      counts: {
        childAssignments: assignments.length,
        orphanages: links.length,
        childrenRecorded: children.length,
        orphanagesProposed: proposals.length,
        visits: visits.length,
        posts: posts.length,
        decisionsTaken: decisions,
      },
    };
  }

  private log(user: AuthUser, action: string, id: string, metadata: Record<string, unknown>) {
    return this.audit.log({ actorId: user.id, actorRole: user.role, action, entityType: 'RoleTransition', entityId: id, metadata });
  }
}
