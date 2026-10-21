import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../../common/services/scope.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async list(
    user: AuthUser,
    params: {
      role?: Role;
      status?: UserStatus;
      countryId?: string;
      provinceId?: string;
      orphanageId?: string;
      q?: string;
    } = {},
  ) {
    const where = {
      AND: [
        this.scope.userWhere(user),
        params.role ? { role: params.role } : {},
        params.status ? { status: params.status } : {},
        params.countryId ? { countryId: params.countryId } : {},
        params.provinceId ? { provinceId: params.provinceId } : {},
        params.orphanageId ? { orphanageId: params.orphanageId } : {},
        params.q
          ? {
              OR: [
                { firstName: { contains: params.q, mode: 'insensitive' as const } },
                { lastName: { contains: params.q, mode: 'insensitive' as const } },
                { email: { contains: params.q, mode: 'insensitive' as const } },
              ],
            }
          : {},
      ],
    };

    return this.prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        avatarUrl: true,
        staffFunction: true,
        organizationName: true,
        twoFactorEnabled: true,
        pushExempt: true,
        lastLoginAt: true,
        createdAt: true,
        invitationExpiresAt: true,
        country: { select: { id: true, iso2: true, nameFr: true } },
        province: { select: { id: true, code: true, nameFr: true } },
        orphanage: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true, role: true } },
        _count: { select: { assignments: true, posts: true } },
      },
    });
  }

  async get(id: string, user: AuthUser) {
    const found = await this.prisma.user.findFirst({
      where: { AND: [{ id }, this.scope.userWhere(user)] },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        avatarUrl: true,
        locale: true,
        staffFunction: true,
        organizationName: true,
        organizationBio: true,
        website: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        failedLoginCount: true,
        createdAt: true,
        country: true,
        province: true,
        orphanage: { select: { id: true, name: true, slug: true } },
        manager: { select: { id: true, firstName: true, lastName: true, role: true } },
        reports: { select: { id: true, firstName: true, lastName: true, role: true } },
        assignments: {
          where: { active: true },
          include: { child: { select: { id: true, publicId: true, firstName: true } } },
        },
      },
    });
    if (!found) throw new NotFoundException('Utilisateur introuvable ou hors de votre périmètre');
    return found;
  }

  /** Enfants d un ambassadeur, groupes par orphelinat (section 11). */
  async myChildren(user: AuthUser) {
    if (user.role !== Role.AMBASSADOR) {
      throw new ForbiddenException('Réservé aux ambassadeurs');
    }

    const assignments = await this.prisma.childAssignment.findMany({
      where: { ambassadorId: user.id, active: true },
      include: {
        child: {
          include: {
            orphanage: { select: { id: true, name: true, slug: true } },
            _count: { select: { timeline: true, projects: true, sponsorships: true } },
            visitReports: { orderBy: { visitedAt: 'desc' }, take: 1, select: { visitedAt: true } },
          },
        },
      },
    });

    const groups = new Map<string, { orphanage: any; children: any[] }>();
    for (const a of assignments) {
      const key = a.child.orphanage.id;
      if (!groups.has(key)) groups.set(key, { orphanage: a.child.orphanage, children: [] });
      groups.get(key).children.push(a.child);
    }

    return [...groups.values()];
  }

  /** Changement de statut : bloquer, debloquer, suspendre. */
  async setStatus(id: string, status: UserStatus, reason: string | undefined, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const allowed: Role[] = [Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Votre rôle ne permet pas de changer le statut d’un compte');
    }

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Utilisateur introuvable');
    if (target.role === Role.SUPER_ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Impossible de modifier un Super Admin');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status, ...(status !== UserStatus.ACTIVE ? { tokenVersion: { increment: 1 } } : {}) },
    });

    if (status !== UserStatus.ACTIVE) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.notifications.notify({
      userId: id,
      title: `Statut de votre compte : ${status}`,
      body: reason ?? null,
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: id,
      metadata: { from: target.status, to: status, reason },
    });

    return updated;
  }

  /** Gel temporaire par l Auditeur Ethique (section 11, HCETDE). */
  async freeze(id: string, reason: string, user: AuthUser) {
    if (user.role !== Role.ETHICS_AUDITOR && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Réservé à l’Auditeur Éthique et au Super Admin');
    }
    if (!reason) throw new BadRequestException('Un motif est obligatoire');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.FROZEN, tokenVersion: { increment: 1 } },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notifications.notifyMany(
      admins.map((a) => a.id),
      {
        title: 'Compte gelé par la gouvernance',
        body: `${updated.firstName} ${updated.lastName} : ${reason}`,
        link: `/utilisateurs?user=${id}`,
      },
    );

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_FROZEN',
      entityType: 'User',
      entityId: id,
      metadata: { reason },
    });

    return updated;
  }

  async warn(id: string, message: string, user: AuthUser) {
    const allowed: Role[] = [Role.SUPER_ADMIN, Role.MODERATOR];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Réservé au Super Admin et au Modérateur');
    }
    await this.notifications.notify({
      userId: id,
      title: 'Avertissement',
      body: message,
      kind: NotificationKind.MODERATION,
      // Message disciplinaire : le detail reste dans l application.
      sensitive: true,
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_WARNED',
      entityType: 'User',
      entityId: id,
      metadata: { message },
    });
    return { success: true };
  }

  /**
   * Dispense d'activer les notifications push. Reserve au Super Admin : c'est la
   * porte de sortie quand un navigateur refuse definitivement l'autorisation ou
   * qu'un reseau bloque les serveurs de notification.
   */
  async setPushExempt(id: string, exempt: boolean, user: AuthUser) {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Reserve au Super Admin');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { pushExempt: exempt },
      select: { id: true, pushExempt: true },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: exempt ? 'PUSH_EXEMPT_GRANTED' : 'PUSH_EXEMPT_REVOKED',
      entityType: 'User',
      entityId: id,
    });
    return updated;
  }

  /**
   * Droit a l'oubli (section 12). Le compte est anonymise, jamais supprime :
   * les ecritures comptables, les validations et le journal d'audit referencent
   * son identifiant et doivent rester verifiables. Ce qui disparait, ce sont les
   * donnees personnelles ; ce qui reste, c'est la tracabilite des operations.
   */
  async forget(id: string, user: AuthUser) {
    const allowed: Role[] = [Role.SUPER_ADMIN, Role.ETHICS_AUDITOR];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Reserve au Super Admin et a l Auditeur Ethique');
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Utilisateur introuvable');
    if (target.email.startsWith('anonyme+')) {
      throw new BadRequestException('Ce compte est deja anonymise');
    }

    const anonymised = await this.prisma.user.update({
      where: { id },
      data: {
        email: `anonyme+${id}@risac.invalid`,
        firstName: 'Compte',
        lastName: 'anonymise',
        phone: null,
        avatarUrl: null,
        organizationName: null,
        organizationBio: null,
        organizationLogo: null,
        website: null,
        twoFactorSecret: null,
        twoFactorEnabled: false,
        invitationToken: null,
        activationOtpHash: null,
        status: UserStatus.BLOCKED,
        // Les sessions ouvertes tombent immediatement.
        tokenVersion: { increment: 1 },
      },
      select: { id: true, status: true },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.device.deleteMany({ where: { userId: id } });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_ANONYMISED',
      entityType: 'User',
      entityId: id,
      metadata: { previousRole: target.role },
    });

    return anonymised;
  }

  async updateProfile(user: AuthUser, dto: any) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        locale: dto.locale,
        avatarUrl: dto.avatarUrl,
        organizationBio: dto.organizationBio,
        website: dto.website,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        locale: true,
        avatarUrl: true,
        organizationBio: true,
        website: true,
      },
    });
  }

  /** Liste publique des partenaires (section 11). */
  async publicPartners() {
    return this.prisma.user.findMany({
      where: { role: Role.PARTNER, status: UserStatus.ACTIVE },
      select: {
        id: true,
        organizationName: true,
        organizationBio: true,
        organizationLogo: true,
        website: true,
        country: { select: { nameFr: true, iso2: true } },
      },
      orderBy: { organizationName: 'asc' },
    });
  }

  async ambassadorsFor(user: AuthUser) {
    return this.prisma.user.findMany({
      where: {
        AND: [{ role: Role.AMBASSADOR, status: UserStatus.ACTIVE }, this.scope.userWhere(user)],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        province: { select: { nameFr: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }
}
