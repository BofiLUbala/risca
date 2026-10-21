import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LedgerAccountKind, Role } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('ledger')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN_FINANCE, Role.ETHICS_AUDITOR)
export class LedgerController {
  constructor(private ledger: LedgerService) {}

  @Get('summary')
  summary() {
    return this.ledger.summary();
  }

  @Get('accounts')
  accounts(@Query('kind') kind?: LedgerAccountKind) {
    return this.ledger.accounts({ kind });
  }

  @Get('accounts/:id/entries')
  entries(@Param('id') id: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    return this.ledger.entries(id, Number(take ?? 100), Number(skip ?? 0));
  }

  @Get('reconcile')
  reconcile() {
    return this.ledger.reconcile();
  }
}
