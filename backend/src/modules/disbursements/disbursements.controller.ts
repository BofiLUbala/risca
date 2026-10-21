import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DisbursementStatus, Role } from '@prisma/client';
import { DisbursementsService } from './disbursements.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('disbursements')
@UseGuards(RolesGuard)
export class DisbursementsController {
  constructor(private disbursements: DisbursementsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: DisbursementStatus,
    @Query('orphanageId') orphanageId?: string,
  ) {
    return this.disbursements.list(user, { status, orphanageId });
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN_FINANCE)
  @Get('queue')
  queue() {
    return this.disbursements.queue();
  }

  /** Preuves de depense cote bailleur (etape 8). */
  @Get('proofs')
  proofs(@CurrentUser() user: AuthUser) {
    return this.disbursements.proofsForDonor(user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.disbursements.get(id, user);
  }

  @Roles(Role.ORPHANAGE_DIRECTOR, Role.SUPER_ADMIN)
  @Post()
  request(
    @Body() dto: { amount: number; reason: string; childId?: string; projectId?: string; currency?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.disbursements.request(dto, user);
  }

  @Roles(Role.AMBASSADOR, Role.SUPER_ADMIN)
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.disbursements.confirm(id, user);
  }

  @Roles(Role.ADMIN_FINANCE, Role.SUPER_ADMIN)
  @Post(':id/pay')
  pay(@Param('id') id: string, @Body() body: { method?: string; ref?: string }, @CurrentUser() user: AuthUser) {
    return this.disbursements.approveAndPay(id, body ?? {}, user);
  }

  @Roles(Role.ADMIN_FINANCE, Role.SUPER_ADMIN, Role.AMBASSADOR)
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    return this.disbursements.reject(id, body?.reason, user);
  }

  @Roles(Role.ORPHANAGE_DIRECTOR, Role.SUPER_ADMIN)
  @Post(':id/receipts')
  addReceipt(
    @Param('id') id: string,
    @Body() dto: { name: string; url: string; amount?: number; kind?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.disbursements.addReceipt(id, dto, user);
  }
}
