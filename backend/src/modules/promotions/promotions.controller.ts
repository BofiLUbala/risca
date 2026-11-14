import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PromotionsService } from './promotions.service';

/** Lettres de promotion : chef régional → Super Admin n°1 → (n°2 ou n°3) → espace de promotion. */
@Controller('promotions/letters')
@UseGuards(RolesGuard)
export class PromotionsController {
  constructor(private promotions: PromotionsService) {}

  @Roles(Role.REGIONAL_MANAGER, Role.SUPER_ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.promotions.list(user);
  }

  @Roles(Role.REGIONAL_MANAGER, Role.SUPER_ADMIN)
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.promotions.get(id, user);
  }

  @Roles(Role.REGIONAL_MANAGER)
  @Post()
  create(@Body() dto: { candidateId: string; requestedRole: Role; subject: string; body: string }, @CurrentUser() user: AuthUser) {
    return this.promotions.create(dto, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post(':id/forward')
  forward(@Param('id') id: string, @Body() body: { toUserId: string }, @CurrentUser() user: AuthUser) {
    return this.promotions.forward(id, body.toUserId, user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post(':id/decide')
  decide(@Param('id') id: string, @Body() body: { approve: boolean; note?: string }, @CurrentUser() user: AuthUser) {
    return this.promotions.decide(id, !!body.approve, body.note, user);
  }

  @Roles(Role.REGIONAL_MANAGER)
  @Post(':id/execute')
  execute(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.promotions.execute(id, user);
  }
}
