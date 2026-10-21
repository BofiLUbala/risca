import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerAccountKind, LedgerEntryKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface PostEntryInput {
  accountId: string;
  kind: LedgerEntryKind;
  amount: number;
  currency?: string;
  reference?: string;
  donationId?: string;
  disbursementId?: string;
  description?: string;
  createdById?: string;
}

/**
 * Registre interne du compte central (section 10.3).
 * Toute ecriture est immuable; le solde du compte suit chaque mouvement.
 * Aucune ecriture en double : la reference est unique par compte et par type.
 */
@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  async accountFor(
    kind: LedgerAccountKind,
    link: { childId?: string; projectId?: string; orphanageId?: string } = {},
    label?: string,
  ) {
    const where: Prisma.LedgerAccountWhereInput = {
      kind,
      childId: link.childId ?? null,
      projectId: link.projectId ?? null,
      orphanageId: link.orphanageId ?? null,
    };

    const existing = await this.prisma.ledgerAccount.findFirst({ where });
    if (existing) return existing;

    return this.prisma.ledgerAccount.create({
      data: {
        kind,
        label: label ?? kind,
        childId: link.childId ?? null,
        projectId: link.projectId ?? null,
        orphanageId: link.orphanageId ?? null,
        currency: 'USD',
      },
    });
  }

  async central() {
    return this.accountFor(LedgerAccountKind.CENTRAL, {}, 'Compte central RISAC');
  }

  async generalFund() {
    return this.accountFor(LedgerAccountKind.GENERAL_FUND, {}, 'Global Congo Children Fund');
  }

  async feesAccount() {
    return this.accountFor(LedgerAccountKind.FEES, {}, 'Frais de fonctionnement');
  }

  /**
   * Ecrit une ligne et met a jour le solde, dans une transaction.
   * Idempotent sur (accountId, reference, kind) : rejoue sans double ecriture.
   */
  async post(input: PostEntryInput) {
    return this.prisma.$transaction(async (tx) => {
      if (input.reference) {
        const dup = await tx.ledgerEntry.findFirst({
          where: { accountId: input.accountId, reference: input.reference, kind: input.kind },
        });
        if (dup) return dup;
      }

      const account = await tx.ledgerAccount.findUnique({ where: { id: input.accountId } });
      if (!account) throw new NotFoundException('Compte introuvable');

      const balanceAfter = Number((account.balance + input.amount).toFixed(2));
      if (balanceAfter < 0) {
        throw new BadRequestException('Solde insuffisant sur ce compte');
      }

      const entry = await tx.ledgerEntry.create({
        data: {
          accountId: input.accountId,
          kind: input.kind,
          amount: input.amount,
          currency: input.currency ?? account.currency,
          balanceAfter,
          reference: input.reference ?? null,
          donationId: input.donationId ?? null,
          disbursementId: input.disbursementId ?? null,
          description: input.description ?? null,
          createdById: input.createdById ?? null,
        },
      });

      await tx.ledgerAccount.update({ where: { id: account.id }, data: { balance: balanceAfter } });
      return entry;
    });
  }

  async balance(accountId: string) {
    const account = await this.prisma.ledgerAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Compte introuvable');
    return { accountId, balance: account.balance, currency: account.currency };
  }

  private async linkedBalance(kind: LedgerAccountKind, where: Prisma.LedgerAccountWhereInput) {
    const account = await this.prisma.ledgerAccount.findFirst({ where: { kind, ...where } });
    return account
      ? { balance: account.balance, currency: account.currency, accountId: account.id }
      : { balance: 0, currency: 'USD', accountId: null };
  }

  async childBalance(childId: string) {
    return this.linkedBalance(LedgerAccountKind.CHILD, { childId });
  }

  async projectBalance(projectId: string) {
    return this.linkedBalance(LedgerAccountKind.PROJECT, { projectId });
  }

  async orphanageBalance(orphanageId: string) {
    return this.linkedBalance(LedgerAccountKind.ORPHANAGE, { orphanageId });
  }

  async entries(accountId: string, take = 100, skip = 0) {
    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        take: Number(take),
        skip: Number(skip),
      }),
      this.prisma.ledgerEntry.count({ where: { accountId } }),
    ]);
    return { items, total };
  }

  async accounts(filter: { kind?: LedgerAccountKind } = {}) {
    return this.prisma.ledgerAccount.findMany({
      where: filter.kind ? { kind: filter.kind } : {},
      orderBy: [{ kind: 'asc' }, { label: 'asc' }],
      include: {
        child: { select: { id: true, publicId: true, firstName: true } },
        project: { select: { id: true, title: true } },
        orphanage: { select: { id: true, name: true } },
        _count: { select: { entries: true } },
      },
    });
  }

  /**
   * Rapprochement quotidien (section 10.4) :
   * le solde stocke doit egaler la somme des ecritures.
   */
  async reconcile() {
    const accounts = await this.prisma.ledgerAccount.findMany();
    const discrepancies: Array<{ accountId: string; label: string; stored: number; computed: number }> = [];

    for (const account of accounts) {
      const agg = await this.prisma.ledgerEntry.aggregate({
        where: { accountId: account.id },
        _sum: { amount: true },
      });
      const computed = Number((agg._sum.amount ?? 0).toFixed(2));
      const stored = Number(account.balance.toFixed(2));
      if (Math.abs(computed - stored) > 0.009) {
        discrepancies.push({ accountId: account.id, label: account.label, stored, computed });
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      accountsChecked: accounts.length,
      balanced: discrepancies.length === 0,
      discrepancies,
    };
  }

  /** Vue globale des flux (tableau de bord Admin Finance). */
  async summary() {
    const [central, general, fees] = await Promise.all([
      this.central(),
      this.generalFund(),
      this.feesAccount(),
    ]);

    const byKind = await this.prisma.ledgerAccount.groupBy({
      by: ['kind'],
      _sum: { balance: true },
      _count: { id: true },
    });

    const donations = await this.prisma.donation.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amountUsd: true, feeAmount: true, netAmount: true },
      _count: { id: true },
    });

    const disbursed = await this.prisma.disbursementRequest.aggregate({
      where: { status: { in: ['PAID', 'SETTLED'] } },
      _sum: { amount: true },
      _count: { id: true },
    });

    return {
      centralBalance: central.balance,
      generalFundBalance: general.balance,
      feesCollected: fees.balance,
      byAccountKind: byKind.map((k) => ({ kind: k.kind, total: k._sum.balance ?? 0, accounts: k._count.id })),
      totalDonated: donations._sum.amountUsd ?? 0,
      totalFees: donations._sum.feeAmount ?? 0,
      totalNet: donations._sum.netAmount ?? 0,
      donationCount: donations._count.id,
      totalDisbursed: disbursed._sum.amount ?? 0,
      disbursementCount: disbursed._count.id,
    };
  }
}
