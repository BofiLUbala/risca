import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DisbursementStatus,
  LedgerAccountKind,
  LedgerEntryKind,
  NotificationKind,
  Role,
  TimelineType,
  Visibility,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../../common/services/scope.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { LedgerService } from '../ledger/ledger.service';
import { OrphanagesService } from '../orphanages/orphanages.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Circuit de decaissement (section 10.3, etapes 4 a 8) :
 *   4. le chef d orphelinat demande (montant + motif)
 *   5. l ambassadeur confirme le besoin
 *   6. l Admin Finance approuve et paie
 *   7. le chef d orphelinat televerse les justificatifs
 *   8. le bailleur voit la preuve de la depense
 *
 * Separation des pouvoirs : l ambassadeur ne touche jamais l argent.
 */
@Injectable()
export class DisbursementsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private orphanages: OrphanagesService,
    private scope: ScopeService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private reference(): string {
    return `DEC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  }

  /** Etape 4 : demande de decaissement par le chef d orphelinat. */
  async request(
    dto: { amount: number; reason: string; childId?: string; projectId?: string; currency?: string },
    user: AuthUser,
  ) {
    this.scope.assertCanWrite(user);

    if (user.role !== Role.ORPHANAGE_DIRECTOR && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Seul un chef d’orphelinat peut demander un décaissement");
    }
    const orphanageId = user.orphanageId;
    if (!orphanageId) throw new BadRequestException('Aucun orphelinat rattache à votre compte');

    // Regle de confiance : seul un orphelinat labellise peut recevoir des fonds.
    await this.orphanages.assertCanReceiveFunds(orphanageId);

    if (dto.amount <= 0) throw new BadRequestException('Le montant doit être positif');

    // Verifie que les fonds affectes existent
    const source = dto.projectId
      ? await this.ledger.projectBalance(dto.projectId)
      : dto.childId
        ? await this.ledger.childBalance(dto.childId)
        : await this.ledger.orphanageBalance(orphanageId);

    if (source.balance < dto.amount) {
      throw new BadRequestException(
        `Solde affecte insuffisant : ${source.balance.toFixed(2)} USD disponibles`,
      );
    }

    if (dto.childId) {
      const child = await this.prisma.child.findUnique({ where: { id: dto.childId } });
      if (!child || child.orphanageId !== orphanageId) {
        throw new BadRequestException('Cet enfant n’est pas dans votre structure');
      }
    }

    const request = await this.prisma.disbursementRequest.create({
      data: {
        reference: this.reference(),
        orphanageId,
        projectId: dto.projectId ?? null,
        childId: dto.childId ?? null,
        amount: dto.amount,
        currency: (dto.currency ?? 'USD').toUpperCase(),
        reason: dto.reason,
        status: DisbursementStatus.REQUESTED,
        requestedById: user.id,
      },
    });

    // Etape 5 : notifier l ambassadeur qui doit confirmer le besoin
    const ambassadors = dto.childId
      ? await this.prisma.childAssignment.findMany({
          where: { childId: dto.childId, active: true },
          select: { ambassadorId: true },
        })
      : await this.prisma.orphanageAmbassador.findMany({
          where: { orphanageId },
          select: { ambassadorId: true },
        });

    await this.notifications.notifyMany(
      ambassadors.map((a) => a.ambassadorId),
      {
        kind: NotificationKind.VALIDATION_REQUEST,
        title: 'Confirmation de besoin attendue',
        body: `${request.amount} ${request.currency} - ${request.reason}`,
        link: `/decaissements/${request.id}`,
        metadata: { disbursementId: request.id },
      },
    );

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DISBURSEMENT_REQUESTED',
      entityType: 'DisbursementRequest',
      entityId: request.id,
      metadata: { amount: dto.amount, reason: dto.reason, orphanageId },
    });

    return request;
  }

  /** Etape 5 : l ambassadeur confirme le besoin. Il ne touche jamais l argent. */
  async confirm(id: string, user: AuthUser) {
    this.scope.assertCanWrite(user);

    const request = await this.prisma.disbursementRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande introuvable');
    if (request.status !== DisbursementStatus.REQUESTED) {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }

    if (user.role === Role.AMBASSADOR) {
      if (request.childId) {
        await this.scope.assertAmbassadorOwnsChild(user, request.childId);
      } else {
        const link = await this.prisma.orphanageAmbassador.findFirst({
          where: { orphanageId: request.orphanageId, ambassadorId: user.id },
        });
        if (!link) throw new ForbiddenException('Vous n’etes pas rattache a cette structure');
      }
    } else if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul l’ambassadeur peut confirmer le besoin');
    }

    const updated = await this.prisma.disbursementRequest.update({
      where: { id },
      data: {
        status: DisbursementStatus.AMBASSADOR_CONFIRMED,
        confirmedByAmbassadorId: user.id,
        confirmedAt: new Date(),
      },
    });

    // Etape 6 : notifier l Admin Finance
    const financeAdmins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN_FINANCE, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notifications.notifyMany(
      financeAdmins.map((u) => u.id),
      {
        kind: NotificationKind.VALIDATION_REQUEST,
        title: 'Décaissement à approuver',
        body: `${request.amount} ${request.currency} - ${request.reason}`,
        link: `/decaissements/${id}`,
        metadata: { disbursementId: id },
      },
    );

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DISBURSEMENT_CONFIRMED',
      entityType: 'DisbursementRequest',
      entityId: id,
    });

    return updated;
  }

  /** Etape 6 : l Admin Finance approuve et paie sur le compte verifie. */
  async approveAndPay(id: string, payout: { method?: string; ref?: string }, user: AuthUser) {
    this.scope.assertCanWrite(user);

    if (user.role !== Role.ADMIN_FINANCE && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Seul l’Admin Finance peut decaisser");
    }

    const request = await this.prisma.disbursementRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande introuvable');
    if (request.status !== DisbursementStatus.AMBASSADOR_CONFIRMED) {
      throw new BadRequestException("La confirmation de l’ambassadeur est requise avant le paiement");
    }

    const orphanage = await this.orphanages.assertCanReceiveFunds(request.orphanageId);

    const sourceAccount = request.projectId
      ? await this.ledger.accountFor(LedgerAccountKind.PROJECT, { projectId: request.projectId })
      : request.childId
        ? await this.ledger.accountFor(LedgerAccountKind.CHILD, { childId: request.childId })
        : await this.ledger.accountFor(LedgerAccountKind.ORPHANAGE, { orphanageId: request.orphanageId });

    if (sourceAccount.balance < request.amount) {
      throw new BadRequestException(
        `Solde insuffisant : ${sourceAccount.balance.toFixed(2)} USD disponibles`,
      );
    }

    await this.ledger.post({
      accountId: sourceAccount.id,
      kind: LedgerEntryKind.DISBURSEMENT_OUT,
      amount: -request.amount,
      reference: request.reference,
      disbursementId: request.id,
      description: `Decaissement vers ${orphanage.name} : ${request.reason}`,
      createdById: user.id,
    });

    const updated = await this.prisma.disbursementRequest.update({
      where: { id },
      data: {
        status: DisbursementStatus.AWAITING_RECEIPTS,
        approvedById: user.id,
        approvedAt: new Date(),
        paidAt: new Date(),
        payoutMethod: payout.method ?? orphanage.mobileMoneyProvider ?? 'MOBILE_MONEY',
        payoutRef: payout.ref ?? null,
      },
    });

    // Etape 7 : demander les justificatifs au chef d orphelinat
    await this.notifications.notify({
      userId: request.requestedById,
      kind: NotificationKind.PAYMENT,
      title: 'Décaissement effectué',
      body: `${request.amount} ${request.currency} verses. Televersez les justificatifs.`,
      link: `/decaissements/${id}`,
      metadata: { disbursementId: id },
    });

    if (request.childId) {
      await this.prisma.timelineEvent.create({
        data: {
          childId: request.childId,
          type: TimelineType.FUNDING,
          title: 'Décaissement effectué',
          description: `${request.amount} ${request.currency} - ${request.reason}`,
          authorId: user.id,
          visibility: Visibility.CONFIDENTIAL,
        },
      });
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DISBURSEMENT_PAID',
      entityType: 'DisbursementRequest',
      entityId: id,
      metadata: { amount: request.amount, orphanageId: request.orphanageId },
    });

    return updated;
  }

  async reject(id: string, reason: string, user: AuthUser) {
    this.scope.assertCanWrite(user);
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('Le motif de refus est obligatoire');
    }

    const request = await this.prisma.disbursementRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande introuvable');

    const closed: DisbursementStatus[] = [
      DisbursementStatus.PAID,
      DisbursementStatus.SETTLED,
      DisbursementStatus.REJECTED,
    ];
    if (closed.includes(request.status)) {
      throw new BadRequestException('Cette demande est déjà close');
    }

    const updated = await this.prisma.disbursementRequest.update({
      where: { id },
      data: { status: DisbursementStatus.REJECTED, rejectionReason: reason },
    });

    await this.notifications.notify({
      userId: request.requestedById,
      kind: NotificationKind.VALIDATION_RESULT,
      title: 'Demande de décaissement refusée',
      body: reason,
      link: `/decaissements/${id}`,
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DISBURSEMENT_REJECTED',
      entityType: 'DisbursementRequest',
      entityId: id,
      metadata: { reason },
    });

    return updated;
  }

  /** Etape 7 : justificatifs obligatoires (factures, photos, video). */
  async addReceipt(
    id: string,
    dto: { name: string; url: string; amount?: number; kind?: string },
    user: AuthUser,
  ) {
    this.scope.assertCanWrite(user);

    const request = await this.prisma.disbursementRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande introuvable');

    if (user.role === Role.ORPHANAGE_DIRECTOR && user.orphanageId !== request.orphanageId) {
      throw new ForbiddenException('Cette demande ne concerne pas votre structure');
    }

    const receipt = await this.prisma.receipt.create({
      data: {
        disbursementId: id,
        name: dto.name,
        url: dto.url,
        amount: dto.amount ?? null,
        kind: dto.kind ?? 'INVOICE',
        uploadedById: user.id,
      },
    });

    const receipts = await this.prisma.receipt.findMany({ where: { disbursementId: id } });
    const justified = receipts.reduce((s, r) => s + (r.amount ?? 0), 0);

    // Entierement justifie : la depense est soldee
    if (justified >= request.amount) {
      await this.prisma.disbursementRequest.update({
        where: { id },
        data: { status: DisbursementStatus.SETTLED },
      });
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'RECEIPT_UPLOADED',
      entityType: 'DisbursementRequest',
      entityId: id,
      metadata: { receiptId: receipt.id, justified, required: request.amount },
    });

    return { receipt, justifiedTotal: justified, settled: justified >= request.amount };
  }

  /**
   * Etape 8 : preuve de la depense cote bailleur.
   * "Votre don de 50 USD a paye les frais scolaires d Amani" + preuves.
   */
  async proofsForDonor(donorId: string) {
    const donations = await this.prisma.donation.findMany({
      where: { donorId, status: 'SUCCEEDED' },
      select: { id: true, reference: true, amount: true, currency: true, netAmount: true, childId: true, projectId: true },
    });

    const childIds = donations.map((d) => d.childId).filter(Boolean) as string[];
    const projectIds = donations.map((d) => d.projectId).filter(Boolean) as string[];

    const disbursements = await this.prisma.disbursementRequest.findMany({
      where: {
        status: { in: [DisbursementStatus.AWAITING_RECEIPTS, DisbursementStatus.SETTLED] },
        OR: [
          childIds.length ? { childId: { in: childIds } } : undefined,
          projectIds.length ? { projectId: { in: projectIds } } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        receipts: true,
        orphanage: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { paidAt: 'desc' },
    });

    const childNames = childIds.length
      ? await this.prisma.child.findMany({
          where: { id: { in: childIds } },
          select: { id: true, firstName: true },
        })
      : [];

    return disbursements.map((d) => {
      const child = childNames.find((c) => c.id === d.childId);
      const subject = child ? child.firstName : (d.project?.title ?? d.orphanage.name);
      return {
        id: d.id,
        reference: d.reference,
        amount: d.amount,
        currency: d.currency,
        reason: d.reason,
        paidAt: d.paidAt,
        status: d.status,
        orphanage: d.orphanage.name,
        summary: `Votre don a finance : ${d.reason} pour ${subject}`,
        receipts: d.receipts.map((r) => ({ id: r.id, name: r.name, url: r.url, kind: r.kind, amount: r.amount })),
      };
    });
  }

  // ------------------------------------------------------------- listes

  async list(user: AuthUser, params: { status?: DisbursementStatus; orphanageId?: string } = {}) {
    const base: any = {};
    if (params.status) base.status = params.status;
    if (params.orphanageId) base.orphanageId = params.orphanageId;

    const scoped: any[] = [base];

    if (user.role === Role.ORPHANAGE_DIRECTOR || user.role === Role.ORPHANAGE_STAFF) {
      scoped.push({ orphanageId: user.orphanageId ?? '__none__' });
    } else if (user.role === Role.AMBASSADOR) {
      const orphanageIds = await this.scope.ambassadorOrphanageIds(user.id);
      scoped.push({ orphanageId: { in: orphanageIds.length ? orphanageIds : ['__none__'] } });
    } else if (user.role === Role.REGIONAL_MANAGER) {
      scoped.push({ orphanage: { provinceId: user.provinceId ?? '__none__' } });
    } else if (user.role === Role.NATIONAL_MANAGER) {
      scoped.push({ orphanage: { countryId: user.countryId ?? '__none__' } });
    }

    return this.prisma.disbursementRequest.findMany({
      where: { AND: scoped },
      orderBy: { createdAt: 'desc' },
      include: {
        orphanage: { select: { id: true, name: true, labelStatus: true, accountVerified: true } },
        project: { select: { id: true, title: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        receipts: true,
      },
    });
  }

  /** File des demandes pour l Admin Finance. */
  async queue() {
    return this.prisma.disbursementRequest.findMany({
      where: { status: DisbursementStatus.AMBASSADOR_CONFIRMED },
      orderBy: { confirmedAt: 'asc' },
      include: {
        orphanage: { select: { id: true, name: true, labelStatus: true, accountVerified: true, mobileMoneyProvider: true } },
        project: { select: { id: true, title: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async get(id: string, user: AuthUser) {
    const request = await this.prisma.disbursementRequest.findUnique({
      where: { id },
      include: {
        orphanage: { select: { id: true, name: true, labelStatus: true, accountVerified: true } },
        project: { select: { id: true, title: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        receipts: true,
      },
    });
    if (!request) throw new NotFoundException('Demande introuvable');
    return request;
  }
}
