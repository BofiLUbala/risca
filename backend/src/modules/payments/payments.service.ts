import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DonationKind,
  LedgerAccountKind,
  LedgerEntryKind,
  NotificationKind,
  PaymentProvider,
  PaymentStatus,
  ProjectStatus,
  Role,
  TimelineType,
  Visibility,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { SettingsService } from '../../common/services/settings.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProvidersService } from './providers.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateDonationDto, ManualTransferDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private providers: ProvidersService,
    private settings: SettingsService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  private reference(prefix: string): string {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  /** Frais de fonctionnement affiches avant le paiement (section 10.4). */
  async quote(amount: number, currency = 'USD') {
    const feePercent = await this.settings.feePercent();
    const rate = await this.providers.exchangeRateToUsd(currency);
    const amountUsd = Number((amount * rate).toFixed(2));
    const feeAmount = Number(((amountUsd * feePercent) / 100).toFixed(2));
    const netAmount = Number((amountUsd - feeAmount).toFixed(2));
    return { amount, currency, exchangeRate: rate, amountUsd, feePercent, feeAmount, netAmount };
  }

  /** Moyens de paiement proposes au bailleur selon son pays. */
  async methodsFor(user: AuthUser) {
    const donor = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { country: true },
    });
    const list = this.providers.availableFor(donor?.country?.iso2);
    return list.map((p) => ({ provider: p, configured: this.providers.isConfigured(p) }));
  }

  // ------------------------------------------------------------- don

  /**
   * Etape 1 du circuit de l argent : le bailleur paie.
   * Cree un don en attente et renvoie l URL de la page web securisee.
   */
  async createDonation(dto: CreateDonationDto, user: AuthUser) {
    if (user.role !== Role.DONOR && user.role !== Role.PARTNER && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul un bailleur ou un partenaire peut faire un don');
    }

    const currency = (dto.currency ?? 'USD').toUpperCase();
    const q = await this.quote(dto.amount, currency);

    if (dto.kind === DonationKind.PROJECT_CONTRIBUTION || dto.projectId) {
      if (!dto.projectId) throw new BadRequestException('Projet obligatoire pour une contribution');
      const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException('Projet introuvable');

      const open: ProjectStatus[] = [ProjectStatus.PUBLISHED, ProjectStatus.IN_EXECUTION];
      if (!open.includes(project.status)) {
        throw new BadRequestException('Ce projet n’accepte pas de contribution dans son etat actuel');
      }
      // Plafond : un projet ne recoit plus de dons une fois l objectif atteint.
      if (project.collectedAmount >= project.targetAmount) {
        throw new BadRequestException(
          'Objectif atteint pour ce projet. Votre don peut être dirigé vers le fonds général',
        );
      }
    }

    if (dto.childId) {
      const child = await this.prisma.child.findUnique({ where: { id: dto.childId } });
      if (!child || child.status !== 'ACTIVE') throw new NotFoundException('Enfant introuvable');
    }

    const reference = this.reference('DON');
    const description =
      dto.kind === DonationKind.GENERAL_FUND
        ? 'Don au Global Congo Children Fund'
        : dto.projectId
          ? 'Contribution a un projet RISAC'
          : 'Don a un enfant RISAC';

    const donor = await this.prisma.user.findUnique({ where: { id: user.id } });

    const session = await this.providers.createCheckout({
      provider: dto.provider,
      reference,
      amount: dto.amount,
      currency,
      description,
      donorEmail: donor.email,
    });

    const donation = await this.prisma.donation.create({
      data: {
        reference,
        donorId: user.id,
        kind: dto.kind,
        amount: dto.amount,
        currency,
        exchangeRate: q.exchangeRate,
        amountUsd: q.amountUsd,
        feeAmount: q.feeAmount,
        netAmount: q.netAmount,
        anonymous: dto.anonymous ?? true,
        message: dto.message ?? null,
        childId: dto.childId ?? null,
        projectId: dto.projectId ?? null,
        provider: dto.provider,
        providerRef: session.providerRef,
        checkoutUrl: session.checkoutUrl,
        status: PaymentStatus.PENDING,
        idempotencyKey: reference,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DONATION_INITIATED',
      entityType: 'Donation',
      entityId: donation.id,
      metadata: { reference, amount: dto.amount, currency, provider: dto.provider },
    });

    return { donation, checkout: session, quote: q };
  }

  /**
   * Etapes 2 et 3 : le compte central est credite, puis le solde est affecte
   * a l enfant, au projet ou au fonds general.
   *
   * Verification de chaque confirmation du fournisseur, aucune ecriture en
   * double (section 10.4) : un don deja regle ressort inchange.
   */
  async settleDonation(reference: string, providerRef?: string) {
    const donation = await this.prisma.donation.findUnique({
      where: { reference },
      include: { child: true, project: true },
    });
    if (!donation) throw new NotFoundException('Don introuvable');

    if (donation.status === PaymentStatus.SUCCEEDED) {
      return { donation, alreadySettled: true };
    }
    if (donation.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Ce don est au statut ${donation.status}`);
    }

    const central = await this.ledger.central();
    const fees = await this.ledger.feesAccount();

    // 2. Compte central RISAC
    await this.ledger.post({
      accountId: central.id,
      kind: LedgerEntryKind.DONATION_IN,
      amount: donation.amountUsd,
      reference: donation.reference,
      donationId: donation.id,
      description: `Don ${donation.reference}`,
    });

    // Frais de fonctionnement preleves
    if (donation.feeAmount > 0) {
      await this.ledger.post({
        accountId: central.id,
        kind: LedgerEntryKind.FEE,
        amount: -donation.feeAmount,
        reference: donation.reference,
        donationId: donation.id,
        description: 'Frais de fonctionnement',
      });
      await this.ledger.post({
        accountId: fees.id,
        kind: LedgerEntryKind.FEE,
        amount: donation.feeAmount,
        reference: donation.reference,
        donationId: donation.id,
        description: `Frais sur ${donation.reference}`,
      });
    }

    // 3. Solde affecte : enfant X / projet Y / fonds general
    let targetAccountId: string;
    if (donation.projectId) {
      const acc = await this.ledger.accountFor(
        LedgerAccountKind.PROJECT,
        { projectId: donation.projectId },
        `Projet ${donation.project?.title ?? donation.projectId}`,
      );
      targetAccountId = acc.id;
    } else if (donation.childId) {
      const acc = await this.ledger.accountFor(
        LedgerAccountKind.CHILD,
        { childId: donation.childId },
        `Solde ${donation.child?.firstName ?? donation.childId}`,
      );
      targetAccountId = acc.id;
    } else {
      const acc = await this.ledger.generalFund();
      targetAccountId = acc.id;
    }

    await this.ledger.post({
      accountId: central.id,
      kind: LedgerEntryKind.ALLOCATION,
      amount: -donation.netAmount,
      reference: donation.reference,
      donationId: donation.id,
      description: 'Affectation',
    });
    await this.ledger.post({
      accountId: targetAccountId,
      kind: LedgerEntryKind.ALLOCATION,
      amount: donation.netAmount,
      reference: donation.reference,
      donationId: donation.id,
      description: `Affectation du don ${donation.reference}`,
    });

    const updated = await this.prisma.donation.update({
      where: { id: donation.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
        providerRef: providerRef ?? donation.providerRef,
        receiptUrl: `/api/payments/donations/${donation.id}/receipt`,
      },
    });

    // Jauge de progression du projet, et plafond a 100 %
    if (donation.projectId) {
      const project = await this.prisma.project.update({
        where: { id: donation.projectId },
        data: { collectedAmount: { increment: donation.netAmount } },
      });
      if (project.collectedAmount >= project.targetAmount && project.status === ProjectStatus.PUBLISHED) {
        await this.prisma.project.update({
          where: { id: project.id },
          data: { status: ProjectStatus.FULLY_FUNDED },
        });
      }
    }

    // Trace dans l historique de l enfant
    if (donation.childId) {
      await this.prisma.timelineEvent.create({
        data: {
          childId: donation.childId,
          type: TimelineType.FUNDING,
          title: 'Financement reçu',
          description: `${donation.netAmount} USD affectes (bailleur anonymise)`,
          visibility: Visibility.CONFIDENTIAL,
        },
      });
    }

    await this.notifications.notify({
      userId: donation.donorId,
      kind: NotificationKind.PAYMENT,
      title: 'Merci pour votre don',
      body: `Votre don de ${donation.amount} ${donation.currency} a bien ete recu.`,
      link: '/mes-dons',
      metadata: { donationId: donation.id },
    });

    await this.audit.log({
      actorId: donation.donorId,
      action: 'DONATION_SETTLED',
      entityType: 'Donation',
      entityId: donation.id,
      metadata: { reference, amountUsd: donation.amountUsd, net: donation.netAmount },
    });

    return { donation: updated, alreadySettled: false };
  }

  /** Confirmation du fournisseur (webhook). */
  async handleWebhook(body: { reference: string; status: string; providerRef?: string }) {
    const status = (body.status || '').toUpperCase();

    if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID'].includes(status)) {
      return this.settleDonation(body.reference, body.providerRef);
    }

    if (['FAILED', 'DECLINED', 'ERROR'].includes(status)) {
      const donation = await this.prisma.donation.findUnique({ where: { reference: body.reference } });
      if (!donation) throw new NotFoundException('Don introuvable');
      if (donation.status === PaymentStatus.SUCCEEDED) {
        return { donation, ignored: true };
      }
      const updated = await this.prisma.donation.update({
        where: { id: donation.id },
        data: { status: PaymentStatus.FAILED },
      });
      await this.notifications.notify({
        userId: donation.donorId,
        kind: NotificationKind.PAYMENT,
        title: 'Paiement échoué',
        body: `Le paiement ${donation.reference} n a pas abouti.`,
      });
      return { donation: updated, ignored: false };
    }

    return { ignored: true, status };
  }

  /** Virement bancaire saisi manuellement par l Admin Finance (section 10.2). */
  async recordManualTransfer(dto: ManualTransferDto, user: AuthUser) {
    const donor = await this.prisma.user.findUnique({ where: { email: dto.donorEmail.toLowerCase() } });
    if (!donor) throw new NotFoundException('Bailleur introuvable pour cette adresse');

    const currency = (dto.currency ?? 'USD').toUpperCase();
    const q = await this.quote(dto.amount, currency);
    const reference = this.reference('VIR');

    const donation = await this.prisma.donation.create({
      data: {
        reference,
        donorId: donor.id,
        kind: dto.kind,
        amount: dto.amount,
        currency,
        exchangeRate: q.exchangeRate,
        amountUsd: q.amountUsd,
        feeAmount: q.feeAmount,
        netAmount: q.netAmount,
        anonymous: true,
        message: dto.note ?? null,
        childId: dto.childId ?? null,
        projectId: dto.projectId ?? null,
        provider: PaymentProvider.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
        idempotencyKey: reference,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'MANUAL_TRANSFER_RECORDED',
      entityType: 'Donation',
      entityId: donation.id,
      metadata: { reference, amount: dto.amount, currency },
    });

    return this.settleDonation(reference);
  }

  /**
   * Remboursement ou reaffectation si un projet est annule (section 10.4),
   * au choix du bailleur.
   */
  async refund(donationId: string, mode: string, reason: string | undefined, user: AuthUser) {
    const donation = await this.prisma.donation.findUnique({ where: { id: donationId } });
    if (!donation) throw new NotFoundException('Don introuvable');
    if (donation.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException('Seul un don réglé peut être remboursé ou réaffecté');
    }

    const sourceAccount = donation.projectId
      ? await this.ledger.accountFor(LedgerAccountKind.PROJECT, { projectId: donation.projectId })
      : donation.childId
        ? await this.ledger.accountFor(LedgerAccountKind.CHILD, { childId: donation.childId })
        : await this.ledger.generalFund();

    if (sourceAccount.balance < donation.netAmount) {
      throw new BadRequestException('Les fonds de ce don ont déjà été décaissés');
    }

    if (mode === 'REALLOCATE') {
      const general = await this.ledger.generalFund();
      await this.ledger.post({
        accountId: sourceAccount.id,
        kind: LedgerEntryKind.REALLOCATION,
        amount: -donation.netAmount,
        reference: `REAFF-${donation.reference}`,
        donationId: donation.id,
        description: reason ?? 'Reaffectation au fonds général',
        createdById: user.id,
      });
      await this.ledger.post({
        accountId: general.id,
        kind: LedgerEntryKind.REALLOCATION,
        amount: donation.netAmount,
        reference: `REAFF-${donation.reference}`,
        donationId: donation.id,
        description: `Reaffectation du don ${donation.reference}`,
        createdById: user.id,
      });

      await this.audit.log({
        actorId: user.id,
        actorRole: user.role,
        action: 'DONATION_REALLOCATED',
        entityType: 'Donation',
        entityId: donationId,
        metadata: { amount: donation.netAmount, reason },
      });

      await this.notifications.notify({
        userId: donation.donorId,
        kind: NotificationKind.PAYMENT,
        title: 'Don réaffecté',
        body: `Votre don ${donation.reference} a ete reaffecte au fonds general.`,
      });

      return { mode: 'REALLOCATE', donation };
    }

    const central = await this.ledger.central();
    await this.ledger.post({
      accountId: sourceAccount.id,
      kind: LedgerEntryKind.REFUND,
      amount: -donation.netAmount,
      reference: `REMB-${donation.reference}`,
      donationId: donation.id,
      description: reason ?? 'Remboursement au bailleur',
      createdById: user.id,
    });
    await this.ledger.post({
      accountId: central.id,
      kind: LedgerEntryKind.REFUND,
      amount: -0,
      reference: `REMB-${donation.reference}`,
      donationId: donation.id,
      description: `Remboursement ${donation.reference}`,
      createdById: user.id,
    });

    const updated = await this.prisma.donation.update({
      where: { id: donationId },
      data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
    });

    if (donation.projectId) {
      await this.prisma.project.update({
        where: { id: donation.projectId },
        data: { collectedAmount: { decrement: donation.netAmount } },
      });
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DONATION_REFUNDED',
      entityType: 'Donation',
      entityId: donationId,
      metadata: { amount: donation.netAmount, reason },
    });

    await this.notifications.notify({
      userId: donation.donorId,
      kind: NotificationKind.PAYMENT,
      title: 'Don remboursé',
      body: `Votre don ${donation.reference} a ete rembourse.`,
    });

    return { mode: 'REFUND', donation: updated };
  }

  /**
   * Retrait d un projet : possibilite pour un bailleur d annuler son
   * inscription avant la fin de la collecte (section 7.3).
   */
  async withdrawFromProject(donationId: string, user: AuthUser) {
    const donation = await this.prisma.donation.findUnique({
      where: { id: donationId },
      include: { project: true },
    });
    if (!donation) throw new NotFoundException('Don introuvable');
    if (donation.donorId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Ce don ne vous appartient pas');
    }
    if (!donation.projectId) throw new BadRequestException('Ce don ne concerne pas un projet');

    const closed: ProjectStatus[] = [
      ProjectStatus.IN_EXECUTION,
      ProjectStatus.COMPLETED,
      ProjectStatus.CLOSED,
    ];
    if (closed.includes(donation.project.status)) {
      throw new BadRequestException('La collecte est terminée, le retrait n’est plus possible');
    }

    const result = await this.refund(donationId, 'REFUND', 'Retrait du bailleur', user);
    await this.prisma.donation.update({ where: { id: donationId }, data: { withdrawnAt: new Date() } });
    return result;
  }

  // ------------------------------------------------------- parrainage

  /** Date de fin selon la regle choisie (section 10.1). */
  private computeEndDate(rule: string, months: number | undefined, birthDate: Date | null): Date | null {
    const now = new Date();
    if (rule === 'UNTIL_18') {
      if (!birthDate) return new Date(now.getTime() + 365 * 24 * 3600000);
      const end = new Date(birthDate);
      end.setFullYear(end.getFullYear() + 18);
      return end > now ? end : null;
    }
    if (rule === 'END_OF_STUDIES') return null;
    const m = months ?? 12;
    const end = new Date(now);
    end.setMonth(end.getMonth() + m);
    return end;
  }

  async createSponsorship(
    dto: { childId: string; monthlyAmount: number; currency?: string; scope?: any; endRule?: string; months?: number; provider?: PaymentProvider },
    user: AuthUser,
  ) {
    if (user.role !== Role.DONOR && user.role !== Role.PARTNER && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Seul un bailleur peut parrainer un enfant');
    }

    const child = await this.prisma.child.findUnique({ where: { id: dto.childId } });
    if (!child || child.status !== 'ACTIVE') throw new NotFoundException('Enfant introuvable');

    const multipleAllowed = Boolean(await this.settings.get('multiple_sponsors_allowed'));
    if (!multipleAllowed) {
      const existing = await this.prisma.sponsorship.findFirst({
        where: { childId: dto.childId, status: 'ACTIVE' },
      });
      if (existing) throw new BadRequestException('Cet enfant a déjà un parrain exclusif');
    }

    const own = await this.prisma.sponsorship.findFirst({
      where: { childId: dto.childId, donorId: user.id, status: 'ACTIVE' },
    });
    if (own) throw new BadRequestException('Vous parrainez déjà cet enfant');

    const rule = dto.endRule ?? 'FIXED_MONTHS';
    const endDate = this.computeEndDate(rule, dto.months, child.birthDate);

    const nextCharge = new Date();
    nextCharge.setMonth(nextCharge.getMonth() + 1);

    const sponsorship = await this.prisma.sponsorship.create({
      data: {
        donorId: user.id,
        childId: dto.childId,
        monthlyAmount: dto.monthlyAmount,
        currency: (dto.currency ?? 'USD').toUpperCase(),
        scope: dto.scope ?? 'FULL',
        endRule: rule,
        endDate,
        nextChargeAt: nextCharge,
        provider: dto.provider ?? null,
        status: 'ACTIVE',
      },
    });

    // Premiere echeance immediate
    const first = await this.createDonation(
      {
        kind: DonationKind.SPONSORSHIP,
        amount: dto.monthlyAmount,
        currency: sponsorship.currency,
        childId: dto.childId,
        provider: dto.provider ?? PaymentProvider.FLUTTERWAVE,
        anonymous: true,
      } as CreateDonationDto,
      user,
    );
    await this.prisma.donation.update({
      where: { id: first.donation.id },
      data: { sponsorshipId: sponsorship.id },
    });

    await this.prisma.subscription.upsert({
      where: { userId_childId: { userId: user.id, childId: dto.childId } },
      update: {},
      create: { userId: user.id, childId: dto.childId },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SPONSORSHIP_CREATED',
      entityType: 'Sponsorship',
      entityId: sponsorship.id,
      metadata: { childId: dto.childId, monthlyAmount: dto.monthlyAmount, rule },
    });

    return { sponsorship, firstPayment: first };
  }

  async updateSponsorship(id: string, dto: { monthlyAmount?: number; scope?: any; endRule?: string; months?: number }, user: AuthUser) {
    const s = await this.prisma.sponsorship.findUnique({ where: { id }, include: { child: true } });
    if (!s) throw new NotFoundException('Parrainage introuvable');
    if (s.donorId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Ce parrainage ne vous appartient pas');
    }

    const data: any = {};
    if (dto.monthlyAmount) data.monthlyAmount = dto.monthlyAmount;
    if (dto.scope) data.scope = dto.scope;
    if (dto.endRule) {
      data.endRule = dto.endRule;
      data.endDate = this.computeEndDate(dto.endRule, dto.months, s.child.birthDate);
    }

    const updated = await this.prisma.sponsorship.update({ where: { id }, data });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SPONSORSHIP_UPDATED',
      entityType: 'Sponsorship',
      entityId: id,
      metadata: data,
    });
    return updated;
  }

  async pauseSponsorship(id: string, user: AuthUser) {
    const s = await this.prisma.sponsorship.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Parrainage introuvable');
    if (s.donorId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Ce parrainage ne vous appartient pas');
    }
    const updated = await this.prisma.sponsorship.update({
      where: { id },
      data: { status: 'PAUSED', pausedAt: new Date(), nextChargeAt: null },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SPONSORSHIP_PAUSED',
      entityType: 'Sponsorship',
      entityId: id,
    });
    return updated;
  }

  async resumeSponsorship(id: string, user: AuthUser) {
    const s = await this.prisma.sponsorship.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Parrainage introuvable');
    if (s.donorId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Ce parrainage ne vous appartient pas');
    }
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const updated = await this.prisma.sponsorship.update({
      where: { id },
      data: { status: 'ACTIVE', pausedAt: null, nextChargeAt: next, failedAttempts: 0 },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SPONSORSHIP_RESUMED',
      entityType: 'Sponsorship',
      entityId: id,
    });
    return updated;
  }

  async cancelSponsorship(id: string, user: AuthUser) {
    const s = await this.prisma.sponsorship.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Parrainage introuvable');
    if (s.donorId !== user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Ce parrainage ne vous appartient pas');
    }
    const updated = await this.prisma.sponsorship.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), nextChargeAt: null },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SPONSORSHIP_CANCELLED',
      entityType: 'Sponsorship',
      entityId: id,
    });
    return updated;
  }

  /**
   * Echeances mensuelles. Echec d un paiement recurrent : nouvelle tentative
   * automatique, puis notification (section 10.4).
   */
  async runRecurringCharges() {
    const now = new Date();
    const due = await this.prisma.sponsorship.findMany({
      where: { status: 'ACTIVE', nextChargeAt: { lte: now } },
      include: { child: true },
    });

    let charged = 0;
    let ended = 0;
    let failed = 0;

    for (const s of due) {
      if (s.endDate && s.endDate <= now) {
        await this.prisma.sponsorship.update({
          where: { id: s.id },
          data: { status: 'COMPLETED', nextChargeAt: null },
        });
        ended++;
        continue;
      }

      try {
        const reference = this.reference('PAR');
        const q = await this.quote(s.monthlyAmount, s.currency);

        await this.prisma.donation.create({
          data: {
            reference,
            donorId: s.donorId,
            kind: DonationKind.SPONSORSHIP,
            amount: s.monthlyAmount,
            currency: s.currency,
            exchangeRate: q.exchangeRate,
            amountUsd: q.amountUsd,
            feeAmount: q.feeAmount,
            netAmount: q.netAmount,
            anonymous: true,
            childId: s.childId,
            sponsorshipId: s.id,
            provider: s.provider ?? PaymentProvider.FLUTTERWAVE,
            status: PaymentStatus.PENDING,
            idempotencyKey: reference,
          },
        });

        await this.settleDonation(reference);

        const next = new Date(now);
        next.setMonth(next.getMonth() + 1);
        await this.prisma.sponsorship.update({
          where: { id: s.id },
          data: { nextChargeAt: next, failedAttempts: 0 },
        });
        charged++;
      } catch (e) {
        const attempts = s.failedAttempts + 1;
        const retry = new Date(now.getTime() + 3 * 24 * 3600000);
        await this.prisma.sponsorship.update({
          where: { id: s.id },
          data: {
            failedAttempts: attempts,
            nextChargeAt: attempts >= 3 ? null : retry,
            status: attempts >= 3 ? 'PAUSED' : 'ACTIVE',
          },
        });
        await this.notifications.notify({
          userId: s.donorId,
          kind: NotificationKind.PAYMENT,
          title: 'Échec du paiement de votre parrainage',
          body:
            attempts >= 3
              ? 'Apres trois tentatives, votre parrainage est mis en pause. Mettez à jour votre moyen de paiement.'
              : 'Une nouvelle tentative aura lieu dans trois jours.',
        });
        failed++;
      }
    }

    return { due: due.length, charged, ended, failed };
  }

  // ------------------------------------------------------- consultation

  async myDonations(user: AuthUser) {
    return this.prisma.donation.findMany({
      where: { donorId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        child: { select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true } },
        project: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async mySponsorships(user: AuthUser) {
    return this.prisma.sponsorship.findMany({
      where: { donorId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        child: {
          select: {
            id: true,
            publicId: true,
            firstName: true,
            publicPhotoUrl: true,
            publicStory: true,
            orphanage: { select: { name: true, province: { select: { nameFr: true } } } },
          },
        },
        donations: { orderBy: { createdAt: 'desc' }, take: 6 },
      },
    });
  }

  /**
   * Mon impact (section 11, tableau de bord Bailleur) :
   * enfants, projets, total donne, preuves de depense.
   */
  async myImpact(user: AuthUser) {
    const donations = await this.prisma.donation.findMany({
      where: { donorId: user.id, status: PaymentStatus.SUCCEEDED },
      include: { child: { select: { id: true, firstName: true } }, project: { select: { id: true, title: true } } },
    });

    const totalUsd = donations.reduce((s, d) => s + d.amountUsd, 0);
    const childIds = [...new Set(donations.map((d) => d.childId).filter(Boolean))] as string[];
    const projectIds = [...new Set(donations.map((d) => d.projectId).filter(Boolean))] as string[];

    const receipts = projectIds.length
      ? await this.prisma.receipt.findMany({
          where: { disbursement: { projectId: { in: projectIds } } },
          include: {
            disbursement: {
              select: { id: true, reason: true, amount: true, paidAt: true, projectId: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];

    const activeSponsorships = await this.prisma.sponsorship.count({
      where: { donorId: user.id, status: 'ACTIVE' },
    });

    return {
      totalDonatedUsd: Number(totalUsd.toFixed(2)),
      donationCount: donations.length,
      childrenSupported: childIds.length,
      projectsSupported: projectIds.length,
      activeSponsorships,
      proofsOfSpending: receipts,
    };
  }

  async donation(id: string, user: AuthUser) {
    const donation = await this.prisma.donation.findUnique({
      where: { id },
      include: {
        child: { select: { id: true, publicId: true, firstName: true } },
        project: { select: { id: true, title: true } },
        donor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!donation) throw new NotFoundException('Don introuvable');

    const privileged: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_FINANCE, Role.ETHICS_AUDITOR];
    if (donation.donorId !== user.id && !privileged.includes(user.role as Role)) {
      throw new ForbiddenException('Ce don ne vous appartient pas');
    }
    return donation;
  }

  async allDonations(params: { status?: PaymentStatus; take?: number; skip?: number } = {}) {
    const where = params.status ? { status: params.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.donation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(params.take ?? 50),
        skip: Number(params.skip ?? 0),
        include: {
          donor: { select: { id: true, firstName: true, lastName: true, email: true } },
          child: { select: { id: true, publicId: true, firstName: true } },
          project: { select: { id: true, title: true } },
        },
      }),
      this.prisma.donation.count({ where }),
    ]);
    return { items, total };
  }
}
