import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ChildStatus, Role, TimelineType } from '@prisma/client';
import { ChildrenService } from './children.service';
import { TimelineService } from './timeline.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AssignAmbassadorDto,
  ChangeStatusDto,
  ConsentDto,
  CreateChildDto,
  HealthRecordDto,
  PsychoSessionDto,
  SchoolRecordDto,
  TimelineEventDto,
  TransferDto,
  UpdateChildDto,
  VisitReportDto,
} from './dto/child.dto';

@Controller('children')
@UseGuards(RolesGuard)
export class ChildrenController {
  constructor(
    private children: ChildrenService,
    private timeline: TimelineService,
  ) {}

  @Public()
  @Get('public/feed')
  publicFeed(
    @Query('countryId') countryId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('warOrphan') warOrphan?: string,
    @Query('minAge') minAge?: string,
    @Query('maxAge') maxAge?: string,
    @Query('needsSponsor') needsSponsor?: string,
    @Query('take') take?: string,
  ) {
    return this.children.publicFeed({
      countryId,
      provinceId,
      warOrphan: warOrphan === 'true',
      minAge: minAge ? Number(minAge) : undefined,
      maxAge: maxAge ? Number(maxAge) : undefined,
      needsSponsor: needsSponsor === 'true',
      take: take ? Number(take) : undefined,
    });
  }

  @Public()
  @Get('public/:id')
  publicProfile(@Param('id') id: string) {
    return this.children.publicProfile(id);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ChildStatus,
    @Query('orphanageId') orphanageId?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.children.list(user, {
      status,
      orphanageId,
      q,
      take: Number(take ?? 50),
      skip: Number(skip ?? 0),
    });
  }

  @Get('alerts/overdue')
  overdue(@CurrentUser() user: AuthUser) {
    return this.timeline.overdueUpdates(user);
  }

  @Get('alerts/nearing-adulthood')
  nearingAdulthood(@CurrentUser() user: AuthUser) {
    return this.timeline.nearingAdulthood(user);
  }

  @Post('check-duplicates')
  checkDuplicates(
    @Body() body: { firstName: string; lastName: string; birthDate?: string; orphanageId?: string },
  ) {
    return this.children.findPotentialDuplicates({
      firstName: body.firstName,
      lastName: body.lastName,
      birthDate: body.birthDate ? new Date(body.birthDate) : null,
      orphanageId: body.orphanageId,
    });
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.children.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ORPHANAGE_DIRECTOR, Role.ORPHANAGE_STAFF, Role.FIELD_AGENT)
  @Post()
  create(@Body() dto: CreateChildDto, @CurrentUser() user: AuthUser) {
    return this.children.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChildDto, @CurrentUser() user: AuthUser) {
    return this.children.update(id, dto, user);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.children.submit(id, user);
  }

  @Post(':id/finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.children.finalizeApproval(id, user);
  }

  @Post('updates/:requestId/apply')
  applyUpdate(@Param('requestId') requestId: string, @CurrentUser() user: AuthUser) {
    return this.children.applyApprovedUpdate(requestId, user);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.children.versions(id, user);
  }

  @Get(':id/diff')
  diff(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.children.diff(id, Number(from), Number(to), user);
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto, @CurrentUser() user: AuthUser) {
    return this.children.changeStatus(id, dto.status, dto.reason, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER)
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignAmbassadorDto, @CurrentUser() user: AuthUser) {
    return this.children.assignAmbassador(id, dto.ambassadorId, user);
  }

  @Post(':id/transfer')
  transfer(@Param('id') id: string, @Body() dto: TransferDto, @CurrentUser() user: AuthUser) {
    return this.children.requestTransfer(id, dto.toOrphanageId, dto.reason, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER)
  @Post('transfers/:transferId/complete')
  completeTransfer(@Param('transferId') transferId: string, @CurrentUser() user: AuthUser) {
    return this.children.completeTransfer(transferId, user);
  }

  @Get(':id/timeline')
  timelineList(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('type') type?: TimelineType,
  ) {
    return this.timeline.list(id, user, type);
  }

  @Post(':id/timeline')
  addEvent(@Param('id') id: string, @Body() dto: TimelineEventDto, @CurrentUser() user: AuthUser) {
    return this.timeline.addEvent(id, dto, user);
  }

  @Post(':id/health')
  addHealth(@Param('id') id: string, @Body() dto: HealthRecordDto, @CurrentUser() user: AuthUser) {
    return this.timeline.addHealth(id, dto, user);
  }

  @Get(':id/psycho')
  psycho(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.timeline.psychoSessions(id, user);
  }

  @Post(':id/psycho')
  addPsycho(@Param('id') id: string, @Body() dto: PsychoSessionDto, @CurrentUser() user: AuthUser) {
    return this.timeline.addPsychoSession(id, dto, user);
  }

  @Post(':id/school')
  addSchool(@Param('id') id: string, @Body() dto: SchoolRecordDto, @CurrentUser() user: AuthUser) {
    return this.timeline.addSchoolRecord(id, dto, user);
  }

  @Post(':id/consent')
  addConsent(@Param('id') id: string, @Body() dto: ConsentDto, @CurrentUser() user: AuthUser) {
    return this.timeline.addConsent(id, dto, user);
  }

  @Post('consents/:consentId/revoke')
  revokeConsent(@Param('consentId') consentId: string, @CurrentUser() user: AuthUser) {
    return this.timeline.revokeConsent(consentId, user);
  }

  @Post(':id/visit')
  addVisit(@Param('id') id: string, @Body() dto: VisitReportDto, @CurrentUser() user: AuthUser) {
    return this.timeline.addVisitReport(id, dto, user);
  }
}
