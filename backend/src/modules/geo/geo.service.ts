import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Pays et subdivisions ISO 3166 / 3166-2 (section 13).
 * Jamais saisis a la main : toujours choisis dans ces listes liees.
 */
@Injectable()
export class GeoService {
  constructor(private prisma: PrismaService) {}

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
