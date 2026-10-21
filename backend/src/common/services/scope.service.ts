import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Perimetre de visibilite par role (Plan fonctionnel sections 3 et 12).
 * Traduit un utilisateur authentifie en filtres Prisma.
 */
@Injectable()
export class ScopeService {
  constructor(private prisma: PrismaService) {}

  isGlobal(role: Role | string): boolean {
    const globals: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_FINANCE, Role.MODERATOR, Role.ETHICS_AUDITOR];
    return globals.includes(role as Role);
  }

  isReadOnly(role: Role | string): boolean {
    return role === Role.ETHICS_AUDITOR;
  }

  async assignedChildIds(ambassadorId: string): Promise<string[]> {
    const rows = await this.prisma.childAssignment.findMany({
      where: { ambassadorId, active: true },
      select: { childId: true },
    });
    return rows.map((r) => r.childId);
  }

  async ambassadorOrphanageIds(ambassadorId: string): Promise<string[]> {
    const rows = await this.prisma.orphanageAmbassador.findMany({
      where: { ambassadorId },
      select: { orphanageId: true },
    });
    return rows.map((r) => r.orphanageId);
  }

  async childWhere(user: AuthUser): Promise<Prisma.ChildWhereInput> {
    switch (user.role) {
      case Role.SUPER_ADMIN:
      case Role.ADMIN_FINANCE:
      case Role.MODERATOR:
      case Role.ETHICS_AUDITOR:
        return {};
      case Role.NATIONAL_MANAGER:
        return { orphanage: { countryId: user.countryId ?? NONE } };
      case Role.REGIONAL_MANAGER:
      case Role.FIELD_AGENT:
        return { orphanage: { provinceId: user.provinceId ?? NONE } };
      case Role.AMBASSADOR: {
        const ids = await this.assignedChildIds(user.id);
        return { id: { in: ids.length ? ids : [NONE] } };
      }
      case Role.ORPHANAGE_DIRECTOR:
      case Role.ORPHANAGE_STAFF:
        return { orphanageId: user.orphanageId ?? NONE };
      case Role.DONOR:
      case Role.PARTNER:
        return { status: 'ACTIVE' };
      default:
        return { id: NONE };
    }
  }

  orphanageWhere(user: AuthUser): Prisma.OrphanageWhereInput {
    switch (user.role) {
      case Role.SUPER_ADMIN:
      case Role.ADMIN_FINANCE:
      case Role.MODERATOR:
      case Role.ETHICS_AUDITOR:
        return {};
      case Role.NATIONAL_MANAGER:
        return { countryId: user.countryId ?? NONE };
      case Role.REGIONAL_MANAGER:
      case Role.FIELD_AGENT:
        return { provinceId: user.provinceId ?? NONE };
      case Role.AMBASSADOR:
        return { ambassadorLinks: { some: { ambassadorId: user.id } } };
      case Role.ORPHANAGE_DIRECTOR:
      case Role.ORPHANAGE_STAFF:
        return { id: user.orphanageId ?? NONE };
      default:
        return { status: 'APPROVED' };
    }
  }

  userWhere(user: AuthUser): Prisma.UserWhereInput {
    switch (user.role) {
      case Role.SUPER_ADMIN:
      case Role.MODERATOR:
      case Role.ETHICS_AUDITOR:
        return {};
      case Role.NATIONAL_MANAGER:
        return { countryId: user.countryId ?? NONE };
      case Role.REGIONAL_MANAGER:
        return { provinceId: user.provinceId ?? NONE };
      case Role.ORPHANAGE_DIRECTOR:
        return { orphanageId: user.orphanageId ?? NONE };
      default:
        return { id: user.id };
    }
  }

  async assertAmbassadorOwnsChild(user: AuthUser, childId: string): Promise<void> {
    if (user.role !== Role.AMBASSADOR) return;
    const link = await this.prisma.childAssignment.findFirst({
      where: { ambassadorId: user.id, childId, active: true },
    });
    if (!link) {
      throw new ForbiddenException(MSG_NOT_ASSIGNED);
    }
  }

  async canReadChild(user: AuthUser, childId: string): Promise<boolean> {
    const where = await this.childWhere(user);
    const found = await this.prisma.child.findFirst({
      where: { AND: [{ id: childId }, where] },
      select: { id: true },
    });
    return !!found;
  }

  assertCanWrite(user: AuthUser): void {
    if (this.isReadOnly(user.role)) {
      throw new ForbiddenException(MSG_READ_ONLY);
    }
  }

  async canReadPsycho(user: AuthUser, childId: string): Promise<boolean> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ETHICS_AUDITOR) return true;
    if (user.role === Role.ORPHANAGE_STAFF && user.staffFunction === 'PSYCHOLOGIST') {
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        select: { orphanageId: true },
      });
      return child?.orphanageId === user.orphanageId;
    }
    if (user.role === Role.AMBASSADOR) {
      const link = await this.prisma.childAssignment.findFirst({
        where: { ambassadorId: user.id, childId, active: true },
      });
      return !!link;
    }
    return false;
  }
}

const NONE = '__none__';
const MSG_NOT_ASSIGNED = "Cet enfant ne vous est pas assigne";
const MSG_READ_ONLY = "L'Auditeur Éthique dispose d'un acces en lecture seule";
