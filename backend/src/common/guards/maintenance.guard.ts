import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { SettingsService, SETTING_KEYS } from '../services/settings.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Mode maintenance programmé (section 11).
 *
 * Quand le Super Admin l'active, la plateforme refuse les requêtes avec un 503
 * et un message explicite. Trois exceptions indispensables, sans lesquelles la
 * maintenance serait un verrou sans clé :
 *
 * - le Super Admin continue de travailler, c'est lui qui doit pouvoir la lever ;
 * - l'authentification reste ouverte, sinon personne ne peut se connecter pour
 *   la désactiver ;
 * - les webhooks de paiement passent, pour ne pas perdre la confirmation d'un
 *   don déjà débité chez le bailleur.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private settings: SettingsService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const active = await this.settings.get<boolean>(SETTING_KEYS.MAINTENANCE_MODE);
    if (!active) return true;

    const req = context.switchToHttp().getRequest();
    const path: string = req?.url ?? '';

    // L'authentification et les webhooks restent toujours joignables.
    if (path.includes('/auth/') || path.includes('/payments/webhook')) return true;

    // La lecture publique reste ouverte : le site vitrine ne tombe pas.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic && req?.method === 'GET') return true;

    if (req?.user?.role === Role.SUPER_ADMIN) return true;

    throw new ServiceUnavailableException(
      'RISAC est en maintenance. La plateforme sera de nouveau disponible sous peu.',
    );
  }
}
