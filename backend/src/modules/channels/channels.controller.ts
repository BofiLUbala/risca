import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ChannelType, Role } from '@prisma/client';
import { ChannelsService } from './channels.service';
import { ChannelsGateway } from './channels.gateway';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('channels')
@UseGuards(RolesGuard)
export class ChannelsController {
  constructor(
    private channels: ChannelsService,
    private gateway: ChannelsGateway,
  ) {}

  @Get()
  myChannels(@CurrentUser() user: AuthUser) {
    return this.channels.myChannels(user);
  }

  @Roles(Role.SUPER_ADMIN, Role.MODERATOR)
  @Get('all')
  all(@CurrentUser() user: AuthUser) {
    return this.channels.allChannels(user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.channels.get(id, user);
  }

  @Get(':id/messages')
  messages(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
    @Query('before') before?: string,
  ) {
    return this.channels.messages(id, user, Number(take ?? 50), before);
  }

  @Get(':id/search')
  search(@Param('id') id: string, @Query('q') q: string, @CurrentUser() user: AuthUser) {
    return this.channels.search(id, q, user);
  }

  @Post(':id/messages')
  async send(
    @Param('id') id: string,
    @Body() body: { content: string; attachments?: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    const message = await this.channels.send(id, body, user);
    this.gateway.server?.to(`channel:${id}`).emit('message:new', message);
    return message;
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.channels.markRead(id, user);
  }

  @Post('messages/:messageId/pin')
  pin(
    @Param('messageId') messageId: string,
    @Body() body: { pinned: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.channels.pin(messageId, body?.pinned ?? true, user);
  }

  @Roles(Role.MODERATOR, Role.SUPER_ADMIN)
  @Post('messages/:messageId/hide')
  hide(
    @Param('messageId') messageId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.channels.hideMessage(messageId, body?.reason, user);
  }

  @Roles(Role.DONOR, Role.PARTNER)
  @Post('donor/:childId')
  openDonorChannel(@Param('childId') childId: string, @CurrentUser() user: AuthUser) {
    return this.channels.openDonorChannel(childId, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER)
  @Post()
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.channels.create(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER)
  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body() body: { userId: string; canWrite?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.channels.addMember(id, body.userId, body.canWrite ?? true, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER)
  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.channels.removeMember(id, userId, user);
  }
}
