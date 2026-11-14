import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WORLD_COUNTRIES, WORLD_PROVINCES } from './world-geo.data';

/**
 * Pays et subdivisions ISO 3166 / 3166-2 (section 13).
 * Jamais saisis a la main : toujours choisis dans ces listes liees.
 */
@Injectable()
export class GeoService implements OnModuleInit {
  private readonly logger = new Logger(GeoService.name);

  constructor(private prisma: PrismaService) {}

  /** Complete la base avec tous les pays du monde et leurs provinces (idempotent). */
  onModuleInit() {
    this.ensureWorldData().catch((e) => this.logger.error(`Synchronisation geographique : ${e?.message ?? e}`));
  }

  async ensureWorldData() {
    const existing = await this.prisma.country.findMany({ select: { iso2: true, iso3: true } });
    const known = new Set(existing.map((c) => c.iso2));
    const usedIso3 = new Set(existing.map((c) => c.iso3));
    const fresh = WORLD_COUNTRIES.filter(([iso2, iso3]) => !known.has(iso2) && !usedIso3.has(iso3));
    if (fresh.length) {
      await this.prisma.country.createMany({
        data: fresh.map(([iso2, iso3, nameFr, nameEn, currency, phone]) => ({
          iso2,
          iso3,
          nameFr,
          nameEn,
          currency: currency || 'USD',
          phoneCode: phone || null,
        })),
        skipDuplicates: true,
      });
    }
    const countries = await this.prisma.country.findMany({
      select: { id: true, iso2: true, _count: { select: { provinces: true } } },
    });
    let added = 0;
    for (const c of countries) {
      const list = WORLD_PROVINCES[c.iso2];
      if (!list || c._count.provinces >= list.length) continue;
      const res = await this.prisma.province.createMany({
        data: list.map(([code, name]) => ({ code, nameFr: name, nameEn: name, countryId: c.id })),
        skipDuplicates: true,
      });
      added += res.count;
    }
    if (fresh.length || added) {
      this.logger.log(`Geographie mondiale : +${fresh.length} pays, +${added} provinces`);
    }
  }

  async countries(activeOnly = true) {
    return this.prisma.country.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { nameFr: 'asc' },
      select: {
        id: true,
        iso2: true,
        iso3: true,
        nameFr: true,
        nameEn: true,
        currency: true,
        phoneCode: true,
        active: true,
        _count: { select: { provinces: true, orphanages: true } },
      },
    });
  }

  async country(id: string) {
    const country = await this.prisma.country.findUnique({
      where: { id },
      include: { provinces: { orderBy: { nameFr: 'asc' } } },
    });
    if (!country) throw new NotFoundException('Pays introuvable');
    return country;
  }

  async provinces(countryId: string) {
    return this.prisma.province.findMany({
      where: { countryId },
      orderBy: { nameFr: 'asc' },
      select: {
        id: true,
        code: true,
        nameFr: true,
        nameEn: true,
        riskZone: true,
        _count: { select: { orphanages: true } },
      },
    });
  }

  async setCountryActive(id: string, active: boolean) {
    return this.prisma.country.update({ where: { id }, data: { active } });
  }

  async setProvinceRiskZone(id: string, riskZone: boolean) {
    return this.prisma.province.update({ where: { id }, data: { riskZone } });
  }
}
