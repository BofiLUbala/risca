import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FieldType, Role, Visibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Modeles de dossier par pays (section 5.2).
 * Ajouter un pays ou un champ ne demande aucun changement de code.
 */
@Injectable()
export class TemplatesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private assertCanEdit(user: AuthUser, countryId?: string) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (user.role === Role.NATIONAL_MANAGER && (!countryId || user.countryId === countryId)) return;
    throw new ForbiddenException('Réservé au Super Admin et au Responsable National de ce pays');
  }

  async list() {
    return this.prisma.dossierTemplate.findMany({
      include: {
        country: { select: { id: true, iso2: true, nameFr: true } },
        _count: { select: { sections: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async byCountry(countryId: string) {
    const template = await this.prisma.dossierTemplate.findUnique({
      where: { countryId },
      include: {
        country: { select: { id: true, iso2: true, nameFr: true } },
        sections: { orderBy: { order: 'asc' }, include: { fields: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!template) throw new NotFoundException('Aucun modele de dossier pour ce pays');
    return template;
  }

  async createTemplate(countryId: string, name: string, user: AuthUser) {
    this.assertCanEdit(user, countryId);
    const template = await this.prisma.dossierTemplate.create({
      data: { countryId, name, version: 1, active: true },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'TEMPLATE_CREATED',
      entityType: 'DossierTemplate',
      entityId: template.id,
      metadata: { countryId },
    });
    return template;
  }

  async addSection(templateId: string, dto: any, user: AuthUser) {
    const template = await this.prisma.dossierTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Modèle introuvable');
    this.assertCanEdit(user, template.countryId);

    return this.prisma.dossierSection.create({
      data: {
        templateId,
        key: dto.key,
        labelFr: dto.labelFr,
        labelEn: dto.labelEn,
        order: dto.order ?? 0,
        visibility: dto.visibility ?? Visibility.CONFIDENTIAL,
      },
    });
  }

  async addField(sectionId: string, dto: any, user: AuthUser) {
    const section = await this.prisma.dossierSection.findUnique({
      where: { id: sectionId },
      include: { template: true },
    });
    if (!section) throw new NotFoundException('Section introuvable');
    this.assertCanEdit(user, section.template.countryId);

    const field = await this.prisma.dossierField.create({
      data: {
        sectionId,
        key: dto.key,
        labelFr: dto.labelFr,
        labelEn: dto.labelEn,
        type: dto.type ?? FieldType.TEXT,
        required: dto.required ?? false,
        visibility: dto.visibility ?? section.visibility,
        options: dto.options ?? [],
        helpText: dto.helpText ?? null,
        order: dto.order ?? 0,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'TEMPLATE_FIELD_ADDED',
      entityType: 'DossierTemplate',
      entityId: section.templateId,
      metadata: { sectionId, key: dto.key },
    });

    return field;
  }

  async updateField(fieldId: string, dto: any, user: AuthUser) {
    const field = await this.prisma.dossierField.findUnique({
      where: { id: fieldId },
      include: { section: { include: { template: true } } },
    });
    if (!field) throw new NotFoundException('Champ introuvable');
    this.assertCanEdit(user, field.section.template.countryId);

    return this.prisma.dossierField.update({ where: { id: fieldId }, data: dto });
  }

  async removeField(fieldId: string, user: AuthUser) {
    const field = await this.prisma.dossierField.findUnique({
      where: { id: fieldId },
      include: { section: { include: { template: true } } },
    });
    if (!field) throw new NotFoundException('Champ introuvable');
    this.assertCanEdit(user, field.section.template.countryId);

    await this.prisma.dossierField.delete({ where: { id: fieldId } });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'TEMPLATE_FIELD_REMOVED',
      entityType: 'DossierTemplate',
      entityId: field.section.templateId,
      metadata: { fieldId, key: field.key },
    });
    return { success: true };
  }
}
