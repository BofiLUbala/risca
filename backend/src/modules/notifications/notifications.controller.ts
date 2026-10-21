import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DevicePlatform, NotificationKind, Role } from '@prisma/client';
import { NotificationsService } from '../../common/services/notifications.service';
import { DevicesService } from './devices.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private devices: DevicesService,
  ) {}

  /**
   * Enregistrement de l'appareil pour les notifications push. Appele apres la
   * connexion, puis a chaque fois que Firebase renouvelle le jeton.
   */
  @Post('devices')
  registerDevice(
    @Body() body: { token: string; platform: string; label?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const token = body?.token?.trim();
    if (!token) throw new BadRequestException('Jeton d’appareil manquant');

    const platform = String(body?.platform ?? '').toUpperCase();
    if (!Object.values(DevicePlatform).includes(platform as DevicePlatform)) {
      throw new BadRequestException('Plateforme inconnue : ANDROID, IOS ou WEB attendu');
    }

    return this.devices.register(user, token, platform as DevicePlatform, body?.label);
  }

  /** Retrait a la deconnexion : l'appareil ne recoit plus rien. */
  @Delete('devices/:token')
  unregisterDevice(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.devices.unregister(user.id, token);
  }

  /** Appareils de la personne connectee, pour les afficher dans son profil. */
  @Get('devices')
  listDevices(@CurrentUser() user: AuthUser) {
    return this.devices.listForUser(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.listForUser(user.id, unread === 'true');
  }

  @Get('count')
  count(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id).then((unread) => ({ unread }));
  }

  @Post(':id/read')
  read(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  /** Notifications ciblees : tous, pays, role, region (section 11). */
  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER, Role.REGIONAL_MANAGER)
  @Post('broadcast')
  broadcast(
    @Body()
    body: {
      countryId?: string;
      provinceId?: string;
      role?: Role;
      userId?: string;
      title: string;
      body?: string;
      link?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const filter: any = {};
    // Une personne precise : le Super Admin vise un compte, les autres filtres tombent.
    if (body.userId) {
      return this.notifications.broadcast(
        { userId: body.userId },
        { title: body.title, body: body.body, link: body.link, kind: NotificationKind.BROADCAST },
      );
    }
    if (user.role === Role.NATIONAL_MANAGER) filter.countryId = user.countryId;
    else if (user.role === Role.REGIONAL_MANAGER) filter.provinceId = user.provinceId;
    else {
      if (body.countryId) filter.countryId = body.countryId;
      if (body.provinceId) filter.provinceId = body.provinceId;
    }
    if (body.role) filter.role = body.role;

    return this.notifications.broadcast(filter, {
      title: body.title,
      body: body.body,
      link: body.link,
      kind: NotificationKind.BROADCAST,
    });
  }
}
