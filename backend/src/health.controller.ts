import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

/**
 * Sonde publique utilisee par l'hebergeur (health check) et par le ping
 * anti-mise-en-veille des offres gratuites. N'expose aucune donnee metier.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', uptime: Math.round(process.uptime()), at: new Date().toISOString() };
  }
}
