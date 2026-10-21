import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ReportStatus, Role, TicketStatus } from '@prisma/client';
import { ModerationService } from './moderation.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('moderation')
@UseGuards(RolesGuard)
export class ModerationController {
  constructor(private moderation: ModerationService) {}

  @Post('reports')
  report(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.moderation.report(dto, user);
  }

  @Roles(Role.MODERATOR, Role.SUPER_ADMIN, Role.ETHICS_AUDITOR)
  @Get('reports')
  listReports(@CurrentUser() user: AuthUser, @Query('status') status?: ReportStatus) {
    return this.moderation.listReports(user, status);
  }

  @Roles(Role.MODERATOR, Role.SUPER_ADMIN, Role.ETHICS_AUDITOR)
  @Post('reports/:id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() body: { status: ReportStatus; resolution: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.moderation.resolveReport(id, body.status, body.resolution, user);
  }

  @Post('tickets')
  openTicket(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.moderation.openTicket(dto, user);
  }

  @Get('tickets')
  listTickets(@CurrentUser() user: AuthUser, @Query('status') status?: TicketStatus) {
    return this.moderation.listTickets(user, status);
  }

  @Get('tickets/:id')
  getTicket(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.moderation.getTicket(id, user);
  }

  @Post('tickets/:id/respond')
  respond(@Param('id') id: string, @Body() body: { message: string }, @CurrentUser() user: AuthUser) {
    return this.moderation.respondTicket(id, body.message, user);
  }

  @Roles(Role.MODERATOR, Role.SUPER_ADMIN)
  @Post('tickets/:id/close')
  close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.moderation.closeTicket(id, user);
  }
}
