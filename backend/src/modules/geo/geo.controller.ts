import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GeoService } from './geo.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('geo')
@UseGuards(RolesGuard)
export class GeoController {
  constructor(private geo: GeoService) {}

  @Public()
  @Get('countries')
  countries(@Query('all') all?: string) {
    return this.geo.countries(all !== 'true');
  }

  @Public()
  @Get('countries/:id')
  country(@Param('id') id: string) {
    return this.geo.country(id);
  }

  @Public()
  @Get('countries/:id/provinces')
  provinces(@Param('id') id: string) {
    return this.geo.provinces(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('countries/:id')
  setActive(@Param('id') id: string, @Body() body: { active: boolean }) {
    return this.geo.setCountryActive(id, body.active);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER)
  @Patch('provinces/:id')
  setRisk(@Param('id') id: string, @Body() body: { riskZone: boolean }) {
    return this.geo.setProvinceRiskZone(id, body.riskZone);
  }
}
