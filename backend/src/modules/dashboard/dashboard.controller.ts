import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { AuditService } from '../../common/services/audit.service';
import { SettingsService, SETTING_KEYS } from '../../common/services/settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(
    private dashboard: DashboardService,
    private audit: AuditService,
    private settings: SettingsService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.dashboard.forUser(user);
  }

  /** Journal d audit complet (Super Admin, Auditeur Ethique). */
  @Roles(Role.SUPER_ADMIN, Role.ETHICS_AUDITOR)
  @Get('audit-log')
  auditLog(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.audit.list({
      entityType,
      entityId,
      actorId,
      take: Number(take ?? 50),
      skip: Number(skip ?? 0),
    });
  }

  /** Parametres : seuils, frais, devises, categories (section 11). */
  @Roles(Role.SUPER_ADMIN)
  @Get('settings')
  getSettings() {
    return this.settings.all();
  }

  /**
   * Valeurs dont les formulaires ont besoin (categories de projet, seuil de validation,
   * devises, frais), ouvertes a tout compte connecte : le formulaire de creation de projet
   * est utilise par des roles qui n'ont pas acces aux parametres complets.
   */
  @Get('settings/public')
  async publicSettings() {
    const [categories, threshold, currencies, fee] = await Promise.all([
      this.settings.get<string[]>(SETTING_KEYS.PROJECT_CATEGORIES),
      this.settings.projectThreshold(),
      this.settings.get<string[]>(SETTING_KEYS.SUPPORTED_CURRENCIES),
      this.settings.feePercent(),
    ]);
    return {
      [SETTING_KEYS.PROJECT_CATEGORIES]: categories,
      [SETTING_KEYS.PROJECT_APPROVAL_THRESHOLD_USD]: threshold,
      [SETTING_KEYS.SUPPORTED_CURRENCIES]: currencies,
      [SETTING_KEYS.PLATFORM_FEE_PERCENT]: fee,
    };
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('settings')
  async setSettings(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    for (const [key, value] of Object.entries(body)) {
      await this.settings.set(key, value);
    }
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SETTINGS_UPDATED',
      entityType: 'SystemSetting',
      metadata: { keys: Object.keys(body) },
    });
    return this.settings.all();
  }
}
