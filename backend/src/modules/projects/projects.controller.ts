import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProjectKind, ProjectStatus, Role } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('projects')
@UseGuards(RolesGuard)
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Public()
  @Get('public')
  publicList(
    @Query('category') category?: string,
    @Query('countryId') countryId?: string,
    @Query('take') take?: string,
  ) {
    return this.projects.publicList({ category, countryId, take: take ? Number(take) : undefined });
  }

  @Public()
  @Get('public/:id')
  publicGet(@Param('id') id: string) {
    return this.projects.get(id);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ProjectStatus,
    @Query('childId') childId?: string,
    @Query('orphanageId') orphanageId?: string,
    @Query('kind') kind?: ProjectKind,
  ) {
    return this.projects.list(user, { status, childId, orphanageId, kind });
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.get(id, user);
  }

  @Roles(Role.ORPHANAGE_DIRECTOR, Role.AMBASSADOR, Role.REGIONAL_MANAGER, Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.projects.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.projects.update(id, dto, user);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.submit(id, user);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.publish(id, user);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() body: { status: ProjectStatus; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.changeStatus(id, body.status, body.reason, user);
  }

  @Roles(Role.ETHICS_AUDITOR, Role.SUPER_ADMIN)
  @Post(':id/freeze')
  freeze(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    return this.projects.freeze(id, body?.reason, user);
  }

  @Post(':id/milestones')
  addMilestone(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.projects.addMilestone(id, dto, user);
  }
}
