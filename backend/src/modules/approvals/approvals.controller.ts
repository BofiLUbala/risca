import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApprovalKind } from '@prisma/client';
import { ApprovalsService } from './approvals.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('approvals')
@UseGuards(RolesGuard)
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}

  /** File de validation du role connecte. */
  @Get('queue')
  queue(@CurrentUser() user: AuthUser) {
    return this.approvals.queueFor(user);
  }

  @Get('for')
  forEntity(@Query('kind') kind: ApprovalKind, @Query('entityId') entityId: string) {
    return this.approvals.historyFor(kind, entityId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.approvals.get(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { comment?: string }) {
    return this.approvals.approve(id, user, body?.comment);
  }

  @Post(':id/request-changes')
  requestChanges(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { comment: string }) {
    return this.approvals.requestChanges(id, user, body?.comment);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { comment: string }) {
    return this.approvals.reject(id, user, body?.comment);
  }
}
