import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Public()
  @Get('partners')
  partners() {
    return this.users.publicPartners();
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('role') role?: Role,
    @Query('status') status?: UserStatus,
    @Query('countryId') countryId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('orphanageId') orphanageId?: string,
    @Query('q') q?: string,
  ) {
    return this.users.list(user, { role, status, countryId, provinceId, orphanageId, q });
  }

  @Get('my-children')
  myChildren(@CurrentUser() user: AuthUser) {
    return this.users.myChildren(user);
  }

  @Get('ambassadors')
  ambassadors(@CurrentUser() user: AuthUser) {
    return this.users.ambassadorsFor(user);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.users.updateProfile(user, dto);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER)
  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() body: { status: UserStatus; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.setStatus(id, body.status, body.reason, user);
  }

  @Roles(Role.ETHICS_AUDITOR, Role.SUPER_ADMIN)
  @Post(':id/freeze')
  freeze(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    return this.users.freeze(id, body?.reason, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ETHICS_AUDITOR)
  @Delete(':id/personal-data')
  forget(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.forget(id, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/push-exempt')
  setPushExempt(@Param('id') id: string, @Body() body: { exempt: boolean }, @CurrentUser() user: AuthUser) {
    return this.users.setPushExempt(id, body?.exempt === true, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.MODERATOR)
  @Post(':id/warn')
  warn(@Param('id') id: string, @Body() body: { message: string }, @CurrentUser() user: AuthUser) {
    return this.users.warn(id, body?.message, user);
  }
}
