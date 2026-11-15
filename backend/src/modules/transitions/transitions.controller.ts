import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TransitionsService } from './transitions.service';

/** Reprise de l'ancien espace après une promotion : accord, clonage, transfert (voir TransitionsService). */
@Controller('transitions')
@UseGuards(RolesGuard)
export class TransitionsController {
  constructor(private transitions: TransitionsService) {}

  /** Ma dernière transition (null si je n'ai jamais été promu). Ouvert à tout rôle connecté. */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.transitions.mine(user);
  }

  @Roles(Role.REGIONAL_MANAGER, Role.NATIONAL_MANAGER, Role.SUPER_ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.transitions.list(user);
  }

  @Get(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transitions.archive(id, user);
  }

  @Roles(Role.REGIONAL_MANAGER, Role.NATIONAL_MANAGER, Role.SUPER_ADMIN)
  @Post(':id/grant')
  grant(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transitions.grant(id, user);
  }

  @Post(':id/clone')
  clone(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transitions.clone(id, user);
  }

  @Roles(Role.REGIONAL_MANAGER, Role.NATIONAL_MANAGER, Role.SUPER_ADMIN)
  @Post(':id/handover')
  handover(@Param('id') id: string, @Body() body: { toUserId: string }, @CurrentUser() user: AuthUser) {
    return this.transitions.handover(id, body.toUserId, user);
  }
}
