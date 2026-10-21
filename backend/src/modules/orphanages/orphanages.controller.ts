import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LabelStatus, OrphanageStatus, Role } from '@prisma/client';
import { OrphanagesService } from './orphanages.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateOrphanageDto,
  LabelDecisionDto,
  LinkAmbassadorDto,
  OrphanageHistoryDto,
  UpdateOrphanageDto,
} from './dto/orphanage.dto';

@Controller('orphanages')
@UseGuards(RolesGuard)
export class OrphanagesController {
  constructor(private orphanages: OrphanagesService) {}

  @Public()
  @Get('public')
  publicList(@Query('countryId') countryId?: string, @Query('provinceId') provinceId?: string) {
    return this.orphanages.publicList({ countryId, provinceId });
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: OrphanageStatus,
    @Query('labelStatus') labelStatus?: LabelStatus,
    @Query('countryId') countryId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('q') q?: string,
  ) {
    return this.orphanages.list(user, { status, labelStatus, countryId, provinceId, q });
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orphanages.get(id, user);
  }

  @Get(':id/staff')
  staff(@Param('id') id: string) {
    return this.orphanages.staff(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER, Role.FIELD_AGENT)
  @Post()
  create(@Body() dto: CreateOrphanageDto, @CurrentUser() user: AuthUser) {
    return this.orphanages.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrphanageDto, @CurrentUser() user: AuthUser) {
    return this.orphanages.update(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.REGIONAL_MANAGER)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orphanages.approveCreation(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.REGIONAL_MANAGER)
  @Post('updates/:requestId/apply')
  applyUpdate(@Param('requestId') requestId: string, @CurrentUser() user: AuthUser) {
    return this.orphanages.applyApprovedUpdate(requestId, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ORPHANAGE_DIRECTOR, Role.REGIONAL_MANAGER)
  @Post(':id/label/apply')
  applyLabel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orphanages.applyForLabel(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.REGIONAL_MANAGER, Role.NATIONAL_MANAGER)
  @Post(':id/label/schedule')
  scheduleAudit(@Param('id') id: string, @Body() body: { scheduledAt: string }, @CurrentUser() user: AuthUser) {
    return this.orphanages.scheduleAudit(id, body.scheduledAt, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.REGIONAL_MANAGER, Role.NATIONAL_MANAGER)
  @Post(':id/label/decide')
  decideLabel(@Param('id') id: string, @Body() dto: LabelDecisionDto, @CurrentUser() user: AuthUser) {
    return this.orphanages.decideLabel(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN_FINANCE)
  @Post(':id/verify-account')
  verifyAccount(@Param('id') id: string, @Body() body: { verified: boolean }, @CurrentUser() user: AuthUser) {
    return this.orphanages.verifyAccount(id, body.verified, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER)
  @Post(':id/ambassadors')
  linkAmbassador(@Param('id') id: string, @Body() dto: LinkAmbassadorDto, @CurrentUser() user: AuthUser) {
    return this.orphanages.linkAmbassador(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER)
  @Delete(':id/ambassadors/:ambassadorId')
  unlinkAmbassador(
    @Param('id') id: string,
    @Param('ambassadorId') ambassadorId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orphanages.unlinkAmbassador(id, ambassadorId, user);
  }

  @Post(':id/history')
  addHistory(@Param('id') id: string, @Body() dto: OrphanageHistoryDto, @CurrentUser() user: AuthUser) {
    return this.orphanages.addHistory(id, dto, user);
  }
}
