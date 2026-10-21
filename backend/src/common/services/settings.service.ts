import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const SETTING_KEYS = {
  PLATFORM_FEE_PERCENT: 'platform_fee_percent',
  PROJECT_APPROVAL_THRESHOLD_USD: 'project_approval_threshold_usd',
  VALIDATION_ESCALATION_HOURS: 'validation_escalation_hours',
  REGIONAL_FINAL_VALIDATION: 'regional_final_validation_for_child',
  MULTIPLE_SPONSORS_ALLOWED: 'multiple_sponsors_allowed',
  PROJECT_CATEGORIES: 'project_categories',
  SUPPORTED_CURRENCIES: 'supported_currencies',
  MAINTENANCE_MODE: 'maintenance_mode',
} as const;

const DEFAULTS: Record<string, unknown> = {
  [SETTING_KEYS.PLATFORM_FEE_PERCENT]: Number(process.env.PLATFORM_FEE_PERCENT ?? 5),
  [SETTING_KEYS.PROJECT_APPROVAL_THRESHOLD_USD]: Number(process.env.PROJECT_APPROVAL_THRESHOLD_USD ?? 1000),
  [SETTING_KEYS.VALIDATION_ESCALATION_HOURS]: Number(process.env.VALIDATION_ESCALATION_HOURS ?? 72),
  [SETTING_KEYS.REGIONAL_FINAL_VALIDATION]: true,
  [SETTING_KEYS.MULTIPLE_SPONSORS_ALLOWED]: true,
  [SETTING_KEYS.PROJECT_CATEGORIES]: ['SANTE', 'SCOLARITE', 'ALIMENTATION', 'INFRASTRUCTURE', 'URGENCE', 'AUTRE'],
  [SETTING_KEYS.SUPPORTED_CURRENCIES]: ['USD', 'EUR', 'CDF'],
  [SETTING_KEYS.MAINTENANCE_MODE]: false,
};

/** Parametres systeme modifiables par le Super Admin (section 11). */
@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get<T = unknown>(key: string): Promise<T> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (row) return row.value as T;
    return DEFAULTS[key] as T;
  }

  async set(key: string, value: unknown) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    });
  }

  async all(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.systemSetting.findMany();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULTS, ...stored };
  }

  async feePercent(): Promise<number> {
    return Number(await this.get(SETTING_KEYS.PLATFORM_FEE_PERCENT));
  }

  async projectThreshold(): Promise<number> {
    return Number(await this.get(SETTING_KEYS.PROJECT_APPROVAL_THRESHOLD_USD));
  }

  async escalationHours(): Promise<number> {
    return Number(await this.get(SETTING_KEYS.VALIDATION_ESCALATION_HOURS));
  }
}
