import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TemplatesService } from './templates.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('templates')
@UseGuards(RolesGuard)
export class TemplatesController {
  constructor(private templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get('country/:countryId')
  byCountry(@Param('countryId') countryId: string) {
    return this.templates.byCountry(countryId);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER)
  @Post()
  create(@Body() body: { countryId: string; name: string }, @CurrentUser() user: AuthUser) {
    return this.templates.createTemplate(body.countryId, body.name, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER)
  @Post(':templateId/sections')
  addSection(@Param('templateId') templateId: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.templates.addSection(templateId, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER)
  @Post('sections/:sectionId/fields')
  addField(@Param('sectionId') sectionId: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.templates.addField(sectionId, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER)
  @Patch('fields/:fieldId')
  updateField(@Param('fieldId') fieldId: string, @Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.templates.updateField(fieldId, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.NATIONAL_MANAGER)
  @Delete('fields/:fieldId')
  removeField(@Param('fieldId') fieldId: string, @CurrentUser() user: AuthUser) {
    return this.templates.removeField(fieldId, user);
  }
}
