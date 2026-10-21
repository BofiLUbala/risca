import { PrismaClient, Role, UserStatus, StaffFunction, LabelStatus, OrphanageStatus, ChildStatus, Visibility, ChannelType, LedgerAccountKind } from '@prisma/client';
import * as argon2 from 'argon2';
import { COUNTRIES, CD_PROVINCES, SIMPLE_PROVINCES } from './seed-data';
import { buildTemplate } from './seed-template';

const prisma = new PrismaClient();
const PWD = 'Risac2026!';

async function seedGeography() {
  for (const c of COUNTRIES) {
    const country = await prisma.country.upsert({
      where: { iso2: c.iso2 },
      update: { nameFr: c.nameFr, nameEn: c.nameEn, currency: c.currency, phoneCode: c.phoneCode },
      create: c,
    });

    const provinces = c.iso2 === 'CD' ? CD_PROVINCES : (SIMPLE_PROVINCES[c.iso2] ?? []);
    for (const p of provinces) {
      await prisma.province.upsert({
        where: { countryId_code: { countryId: country.id, code: p.code } },
        update: { nameFr: p.nameFr, nameEn: p.nameEn, riskZone: (p as any).riskZone ?? false },
        create: {
          countryId: country.id,
          code: p.code,
          nameFr: p.nameFr,
          nameEn: p.nameEn,
          riskZone: (p as any).riskZone ?? false,
        },
      });
    }
  }
  const countries = await prisma.country.count();
  const provinces = await prisma.province.count();
  console.log(`  geographie : ${countries} pays, ${provinces} provinces`);
}

async function seedTemplates() {
  for (const iso2 of ['CD', 'CG', 'BE', 'FR']) {
    const country = await prisma.country.findUnique({ where: { iso2 } });
    if (!country) continue;

    const existing = await prisma.dossierTemplate.findUnique({ where: { countryId: country.id } });
    if (existing) {
      await prisma.dossierTemplate.delete({ where: { id: existing.id } });
    }

    const template = await prisma.dossierTemplate.create({
      data: { countryId: country.id, name: `Modele de dossier - ${country.nameFr}`, version: 1, active: true },
    });

    const sections = buildTemplate(iso2);
    for (let si = 0; si < sections.length; si++) {
      const s = sections[si];
      const section = await prisma.dossierSection.create({
        data: {
          templateId: template.id,
          key: s.key,
          labelFr: s.labelFr,
          labelEn: s.labelEn,
          order: si,
          visibility: s.visibility,
        },
      });
      for (let fi = 0; fi < s.fields.length; fi++) {
        const f = s.fields[fi];
        await prisma.dossierField.create({
          data: {
            sectionId: section.id,
            key: f.key,
            labelFr: f.labelFr,
            labelEn: f.labelEn,
            type: f.type,
            required: f.required ?? false,
            visibility: f.visibility ?? s.visibility,
            options: f.options ?? [],
            helpText: f.helpText ?? null,
            order: fi,
          },
        });
      }
    }
  }
  const fields = await prisma.dossierField.count();
  console.log(`  modeles de dossier : 4 pays, ${fields} champs`);
}

interface UserSeed {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  countryIso?: string;
  provinceCode?: string;
  orphanageSlug?: string;
  staffFunction?: StaffFunction;
  organizationName?: string;
}

const USERS: UserSeed[] = [
  { key: 'superadmin', email: 'admin@risac.org', firstName: 'Albert', lastName: 'Ndondo', role: Role.SUPER_ADMIN, countryIso: 'CD' },
  { key: 'finance', email: 'finance@risac.org', firstName: 'Clarisse', lastName: 'Mbala', role: Role.ADMIN_FINANCE, countryIso: 'CD' },
  { key: 'moderator', email: 'moderation@risac.org', firstName: 'Patrick', lastName: 'Lumbu', role: Role.MODERATOR, countryIso: 'CD' },
  { key: 'auditor', email: 'hcetde@risac.org', firstName: 'Esther', lastName: 'Kabange', role: Role.ETHICS_AUDITOR, countryIso: 'CD' },
  { key: 'national', email: 'national.cd@risac.org', firstName: 'Joseph', lastName: 'Mukendi', role: Role.NATIONAL_MANAGER, countryIso: 'CD' },
  { key: 'regional_nk', email: 'regional.nordkivu@risac.org', firstName: 'Marie', lastName: 'Furaha', role: Role.REGIONAL_MANAGER, countryIso: 'CD', provinceCode: 'CD-NK' },
  { key: 'regional_sk', email: 'regional.sudkivu@risac.org', firstName: 'Didier', lastName: 'Byamungu', role: Role.REGIONAL_MANAGER, countryIso: 'CD', provinceCode: 'CD-SK' },
  { key: 'ambassador1', email: 'ambassadeur1@risac.org', firstName: 'Sarah', lastName: 'Kavira', role: Role.AMBASSADOR, countryIso: 'CD', provinceCode: 'CD-NK' },
  { key: 'ambassador2', email: 'ambassadeur2@risac.org', firstName: 'Olivier', lastName: 'Mugisho', role: Role.AMBASSADOR, countryIso: 'CD', provinceCode: 'CD-SK' },
  { key: 'agent', email: 'agent.terrain@risac.org', firstName: 'Jean', lastName: 'Kambale', role: Role.FIELD_AGENT, countryIso: 'CD', provinceCode: 'CD-NK' },
  { key: 'director1', email: 'chef.espoir@risac.org', firstName: 'Beatrice', lastName: 'Masika', role: Role.ORPHANAGE_DIRECTOR, countryIso: 'CD', provinceCode: 'CD-NK', orphanageSlug: 'orphelinat-espoir-goma' },
  { key: 'director2', email: 'chef.lumiere@risac.org', firstName: 'Pascal', lastName: 'Bahati', role: Role.ORPHANAGE_DIRECTOR, countryIso: 'CD', provinceCode: 'CD-SK', orphanageSlug: 'orphelinat-lumiere-bukavu' },
  { key: 'psy', email: 'psychologue.espoir@risac.org', firstName: 'Nadine', lastName: 'Mwamini', role: Role.ORPHANAGE_STAFF, countryIso: 'CD', provinceCode: 'CD-NK', orphanageSlug: 'orphelinat-espoir-goma', staffFunction: StaffFunction.PSYCHOLOGIST },
  { key: 'educator', email: 'educateur.espoir@risac.org', firstName: 'Serge', lastName: 'Kasereka', role: Role.ORPHANAGE_STAFF, countryIso: 'CD', provinceCode: 'CD-NK', orphanageSlug: 'orphelinat-espoir-goma', staffFunction: StaffFunction.EDUCATOR },
  { key: 'nurse', email: 'infirmier.espoir@risac.org', firstName: 'Alice', lastName: 'Nsimire', role: Role.ORPHANAGE_STAFF, countryIso: 'CD', provinceCode: 'CD-NK', orphanageSlug: 'orphelinat-espoir-goma', staffFunction: StaffFunction.NURSE },
  { key: 'donor1', email: 'bailleur1@example.org', firstName: 'Sophie', lastName: 'Dubois', role: Role.DONOR, countryIso: 'BE' },
  { key: 'donor2', email: 'bailleur2@example.org', firstName: 'Marc', lastName: 'Lefevre', role: Role.DONOR, countryIso: 'FR' },
  { key: 'partner', email: 'partenaire@example.org', firstName: 'Helene', lastName: 'Martin', role: Role.PARTNER, countryIso: 'BE', organizationName: 'Fondation Enfance Solidaire' },
];

const ORPHANAGES = [
  {
    slug: 'orphelinat-espoir-goma',
    name: 'Orphelinat Espoir',
    countryIso: 'CD',
    provinceCode: 'CD-NK',
    city: 'Goma',
    commune: 'Karisimbi',
    totalPlaces: 60,
    occupiedPlaces: 42,
    status: OrphanageStatus.APPROVED,
    labelStatus: LabelStatus.COMPLIANT,
    hideExactLocation: true,
    description: 'Structure d accueil pour enfants orphelins de guerre et deplaces du Nord-Kivu.',
  },
  {
    slug: 'orphelinat-lumiere-bukavu',
    name: 'Orphelinat Lumiere',
    countryIso: 'CD',
    provinceCode: 'CD-SK',
    city: 'Bukavu',
    commune: 'Ibanda',
    totalPlaces: 45,
    occupiedPlaces: 31,
    status: OrphanageStatus.APPROVED,
    labelStatus: LabelStatus.COMPLIANT_WITH_CONDITIONS,
    hideExactLocation: true,
    description: 'Accueil et reinsertion scolaire des enfants vulnerables du Sud-Kivu.',
  },
  {
    slug: 'centre-tumaini-beni',
    name: 'Centre Tumaini',
    countryIso: 'CD',
    provinceCode: 'CD-NK',
    city: 'Beni',
    totalPlaces: 30,
    occupiedPlaces: 18,
    status: OrphanageStatus.PROPOSED,
    labelStatus: LabelStatus.NONE,
    hideExactLocation: true,
    description: 'Nouvelle structure proposee, en attente de validation par le Super Admin.',
  },
];

async function seedOrphanages() {
  for (const o of ORPHANAGES) {
    const country = await prisma.country.findUnique({ where: { iso2: o.countryIso } });
    const province = await prisma.province.findUnique({
      where: { countryId_code: { countryId: country.id, code: o.provinceCode } },
    });

    await prisma.orphanage.upsert({
      where: { slug: o.slug },
      update: {},
      create: {
        slug: o.slug,
        name: o.name,
        description: o.description,
        countryId: country.id,
        provinceId: province.id,
        city: o.city,
        commune: (o as any).commune ?? null,
        totalPlaces: o.totalPlaces,
        occupiedPlaces: o.occupiedPlaces,
        status: o.status,
        labelStatus: o.labelStatus,
        hideExactLocation: o.hideExactLocation,
        labelGrantedAt: o.labelStatus === LabelStatus.COMPLIANT ? new Date('2026-02-01') : null,
        labelExpiresAt: o.labelStatus === LabelStatus.COMPLIANT ? new Date('2028-02-01') : null,
        hasDormitory: true,
        hasDrinkingWater: true,
        hasElectricity: o.slug !== 'centre-tumaini-beni',
        hasSchool: o.slug === 'orphelinat-espoir-goma',
        hasInfirmary: true,
        mobileMoneyProvider: 'M-Pesa',
        mobileMoneyNumber: '+243000000000',
        accountVerified: o.status === OrphanageStatus.APPROVED,
      },
    });
  }
  console.log(`  orphelinats : ${await prisma.orphanage.count()}`);
}

async function seedUsers() {
  const passwordHash = await argon2.hash(PWD);
  const created: Record<string, string> = {};

  for (const u of USERS) {
    const country = u.countryIso ? await prisma.country.findUnique({ where: { iso2: u.countryIso } }) : null;
    const province =
      u.provinceCode && country
        ? await prisma.province.findUnique({ where: { countryId_code: { countryId: country.id, code: u.provinceCode } } })
        : null;
    const orphanage = u.orphanageSlug ? await prisma.orphanage.findUnique({ where: { slug: u.orphanageSlug } }) : null;

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status: UserStatus.ACTIVE,
        countryId: country?.id ?? null,
        provinceId: province?.id ?? null,
        orphanageId: orphanage?.id ?? null,
        staffFunction: u.staffFunction ?? null,
        organizationName: u.organizationName ?? null,
        locale: 'fr',
      },
    });
    created[u.key] = user.id;
  }

  // Hierarchie
  await prisma.user.update({ where: { id: created.national }, data: { managerId: created.superadmin } });
  await prisma.user.update({ where: { id: created.regional_nk }, data: { managerId: created.national } });
  await prisma.user.update({ where: { id: created.regional_sk }, data: { managerId: created.national } });
  await prisma.user.update({ where: { id: created.ambassador1 }, data: { managerId: created.regional_nk } });
  await prisma.user.update({ where: { id: created.ambassador2 }, data: { managerId: created.regional_sk } });
  await prisma.user.update({ where: { id: created.agent }, data: { managerId: created.regional_nk } });
  await prisma.user.update({ where: { id: created.director1 }, data: { managerId: created.superadmin } });
  await prisma.user.update({ where: { id: created.director2 }, data: { managerId: created.superadmin } });
  for (const k of ['psy', 'educator', 'nurse']) {
    await prisma.user.update({ where: { id: created[k] }, data: { managerId: created.director1 } });
  }

  // Directeurs rattaches a leur orphelinat
  const espoir = await prisma.orphanage.findUnique({ where: { slug: 'orphelinat-espoir-goma' } });
  const lumiere = await prisma.orphanage.findUnique({ where: { slug: 'orphelinat-lumiere-bukavu' } });
  await prisma.orphanage.update({ where: { id: espoir.id }, data: { directorId: created.director1 } });
  await prisma.orphanage.update({ where: { id: lumiere.id }, data: { directorId: created.director2 } });

  // Ambassadeurs rattaches aux orphelinats
  await prisma.orphanageAmbassador.upsert({
    where: { orphanageId_ambassadorId: { orphanageId: espoir.id, ambassadorId: created.ambassador1 } },
    update: { isPrimary: true },
    create: { orphanageId: espoir.id, ambassadorId: created.ambassador1, isPrimary: true },
  });
  await prisma.orphanageAmbassador.upsert({
    where: { orphanageId_ambassadorId: { orphanageId: lumiere.id, ambassadorId: created.ambassador2 } },
    update: { isPrimary: true },
    create: { orphanageId: lumiere.id, ambassadorId: created.ambassador2, isPrimary: true },
  });

  console.log(`  utilisateurs : ${await prisma.user.count()} (mot de passe commun : ${PWD})`);
  return created;
}

const CHILDREN = [
  {
    publicId: 'RISAC-CD-0001',
    firstName: 'Amani',
    lastName: 'Bashige',
    sex: 'M',
    birthDate: new Date('2015-04-12'),
    orphanageSlug: 'orphelinat-espoir-goma',
    ambassadorKey: 'ambassador1',
    status: ChildStatus.ACTIVE,
    warOrphan: true,
    displaced: true,
    publicStory: 'Amani a rejoint la structure en janvier 2026. Il aime les mathematiques et le football.',
    publicNeeds: 'Frais scolaires et fournitures pour l annee en cours.',
    lifeProject: 'Devenir enseignant pour aider les enfants de son village.',
    desiredJob: 'Enseignant',
    fonarevStatus: 'ORIENTED',
    fonarevFileNumber: 'FNR-2026-0042',
    admittedAt: new Date('2026-01-12'),
  },
  {
    publicId: 'RISAC-CD-0002',
    firstName: 'Esperance',
    lastName: 'Kahindo',
    sex: 'F',
    birthDate: new Date('2013-09-03'),
    orphanageSlug: 'orphelinat-espoir-goma',
    ambassadorKey: 'ambassador1',
    status: ChildStatus.ACTIVE,
    warOrphan: true,
    publicStory: 'Esperance est passionnee de couture et suit une formation professionnelle.',
    publicNeeds: 'Machine a coudre pour son atelier de formation.',
    lifeProject: 'Ouvrir un atelier de couture.',
    desiredJob: 'Couturiere',
    admittedAt: new Date('2025-06-20'),
  },
  {
    publicId: 'RISAC-CD-0003',
    firstName: 'Josue',
    lastName: 'Mulumba',
    sex: 'M',
    birthDate: new Date('2016-11-28'),
    orphanageSlug: 'orphelinat-espoir-goma',
    ambassadorKey: 'ambassador1',
    status: ChildStatus.IN_VALIDATION,
    abandoned: true,
    publicStory: 'Josue vient d etre accueilli et son dossier est en cours de validation.',
    admittedAt: new Date('2026-09-15'),
  },
  {
    publicId: 'RISAC-CD-0004',
    firstName: 'Neema',
    lastName: 'Wabiwa',
    sex: 'F',
    birthDate: new Date('2012-02-17'),
    orphanageSlug: 'orphelinat-lumiere-bukavu',
    ambassadorKey: 'ambassador2',
    status: ChildStatus.ACTIVE,
    displaced: true,
    publicStory: 'Neema prepare son examen d Etat et souhaite etudier la medecine.',
    publicNeeds: 'Soutien pour les frais d examen et les livres.',
    lifeProject: 'Devenir medecin.',
    desiredJob: 'Medecin',
    admittedAt: new Date('2024-03-05'),
  },
  {
    publicId: 'RISAC-CD-0005',
    firstName: 'Bahati',
    lastName: 'Ngoy',
    sex: 'M',
    birthDate: new Date('2009-07-09'),
    orphanageSlug: 'orphelinat-lumiere-bukavu',
    ambassadorKey: 'ambassador2',
    status: ChildStatus.ACTIVE,
    formerArmedGroup: true,
    publicStory: 'Bahati suit un programme de reinsertion et de formation en mecanique.',
    publicNeeds: 'Outils pour son apprentissage en mecanique.',
    lifeProject: 'Ouvrir un garage.',
    desiredJob: 'Mecanicien',
    postMajorityPrepared: true,
    admittedAt: new Date('2023-11-11'),
  },
];

async function seedChildren(users: Record<string, string>) {
  for (const c of CHILDREN) {
    const orphanage = await prisma.orphanage.findUnique({ where: { slug: c.orphanageSlug } });

    const child = await prisma.child.upsert({
      where: { publicId: c.publicId },
      update: {},
      create: {
        publicId: c.publicId,
        firstName: c.firstName,
        lastName: c.lastName,
        sex: c.sex,
        birthDate: c.birthDate,
        orphanageId: orphanage.id,
        status: c.status,
        warOrphan: (c as any).warOrphan ?? false,
        displaced: (c as any).displaced ?? false,
        abandoned: (c as any).abandoned ?? false,
        formerArmedGroup: (c as any).formerArmedGroup ?? false,
        publicStory: (c as any).publicStory ?? null,
        publicNeeds: (c as any).publicNeeds ?? null,
        lifeProject: (c as any).lifeProject ?? null,
        desiredJob: (c as any).desiredJob ?? null,
        fonarevStatus: (c as any).fonarevStatus ?? null,
        fonarevFileNumber: (c as any).fonarevFileNumber ?? null,
        postMajorityPrepared: (c as any).postMajorityPrepared ?? false,
        admittedAt: c.admittedAt,
        languages: ['Francais', 'Swahili'],
        createdById: users.director1,
        dossierData: {},
      },
    });

    await prisma.childAssignment.deleteMany({ where: { childId: child.id } });
    await prisma.childAssignment.create({
      data: { childId: child.id, ambassadorId: users[c.ambassadorKey], active: true, assignedById: users.superadmin },
    });

    const hasConsent = await prisma.consent.findFirst({ where: { childId: child.id } });
    if (!hasConsent && c.status === ChildStatus.ACTIVE) {
      await prisma.consent.create({
        data: {
          childId: child.id,
          kind: 'PHOTO_VIDEO',
          guardianName: 'Tuteur legal',
          guardianSignedAt: new Date('2026-01-20'),
          witnessId: users[c.ambassadorKey],
        },
      });
    }

    const events = await prisma.timelineEvent.count({ where: { childId: child.id } });
    if (events === 0) {
      await prisma.timelineEvent.create({
        data: {
          childId: child.id,
          type: 'ADMISSION',
          title: `Admission a ${orphanage.name}`,
          description: 'Entree dans le reseau RISAC.',
          occurredAt: c.admittedAt,
          authorId: users.director1,
          visibility: Visibility.CONFIDENTIAL,
        },
      });
      if (c.status === ChildStatus.ACTIVE) {
        await prisma.timelineEvent.create({
          data: {
            childId: child.id,
            type: 'SCHOOLING',
            title: 'Rentree scolaire',
            description: 'Inscription pour l annee scolaire en cours.',
            occurredAt: new Date('2026-09-01'),
            authorId: users.director1,
            isPublic: true,
            visibility: Visibility.PUBLIC,
          },
        });
      }
    }

    const acct = await prisma.ledgerAccount.findFirst({ where: { childId: child.id, kind: LedgerAccountKind.CHILD } });
    if (!acct) {
      await prisma.ledgerAccount.create({
        data: { kind: LedgerAccountKind.CHILD, label: `Solde ${c.firstName}`, childId: child.id, currency: 'USD' },
      });
    }
  }
  console.log(`  enfants : ${await prisma.child.count()}`);
}

async function seedAccountsAndChannels(users: Record<string, string>) {
  // Comptes centraux
  for (const kind of [LedgerAccountKind.CENTRAL, LedgerAccountKind.GENERAL_FUND, LedgerAccountKind.FEES]) {
    const existing = await prisma.ledgerAccount.findFirst({ where: { kind, childId: null, projectId: null, orphanageId: null } });
    if (!existing) {
      const label =
        kind === LedgerAccountKind.CENTRAL
          ? 'Compte central RISAC'
          : kind === LedgerAccountKind.GENERAL_FUND
            ? 'Global Congo Children Fund'
            : 'Frais de fonctionnement';
      await prisma.ledgerAccount.create({ data: { kind, label, currency: 'USD' } });
    }
  }

  for (const slug of ['orphelinat-espoir-goma', 'orphelinat-lumiere-bukavu']) {
    const o = await prisma.orphanage.findUnique({ where: { slug } });
    const existing = await prisma.ledgerAccount.findFirst({ where: { orphanageId: o.id } });
    if (!existing) {
      await prisma.ledgerAccount.create({
        data: { kind: LedgerAccountKind.ORPHANAGE, label: `Solde ${o.name}`, orphanageId: o.id, currency: 'USD' },
      });
    }
  }

  // Canal general
  let general = await prisma.channel.findFirst({ where: { type: ChannelType.GENERAL } });
  if (!general) {
    general = await prisma.channel.create({
      data: {
        type: ChannelType.GENERAL,
        name: 'Canal general RISAC',
        description: 'Lecture pour tous, ecriture reservee aux administrateurs.',
        readOnlyForMembers: true,
        moderated: true,
      },
    });
  }
  const allUsers = await prisma.user.findMany({ select: { id: true, role: true } });
  for (const u of allUsers) {
    const writers: Role[] = [Role.SUPER_ADMIN, Role.MODERATOR, Role.NATIONAL_MANAGER];
    const canWrite = writers.includes(u.role);
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: general.id, userId: u.id } },
      update: { canWrite },
      create: { channelId: general.id, userId: u.id, canWrite },
    });
  }

  // Canal par orphelinat (ambassadeur <-> chef d orphelinat)
  const pairs = [
    { slug: 'orphelinat-espoir-goma', amb: 'ambassador1', dir: 'director1' },
    { slug: 'orphelinat-lumiere-bukavu', amb: 'ambassador2', dir: 'director2' },
  ];
  for (const p of pairs) {
    const o = await prisma.orphanage.findUnique({ where: { slug: p.slug } });
    let ch = await prisma.channel.findFirst({
      where: { type: ChannelType.AMBASSADOR_ORPHANAGE, orphanageId: o.id },
    });
    if (!ch) {
      ch = await prisma.channel.create({
        data: { type: ChannelType.AMBASSADOR_ORPHANAGE, name: `Canal ${o.name}`, orphanageId: o.id },
      });
    }
    for (const uid of [users[p.amb], users[p.dir], users.superadmin]) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: ch.id, userId: uid } },
        update: {},
        create: { channelId: ch.id, userId: uid },
      });
    }
  }

  // Canal regional Nord-Kivu
  let reg = await prisma.channel.findFirst({ where: { type: ChannelType.REGIONAL } });
  if (!reg) {
    reg = await prisma.channel.create({ data: { type: ChannelType.REGIONAL, name: 'Region Nord-Kivu' } });
    for (const k of ['regional_nk', 'ambassador1', 'agent']) {
      await prisma.channelMember.create({ data: { channelId: reg.id, userId: users[k] } });
    }
  }

  // Canal partenaires
  let part = await prisma.channel.findFirst({ where: { type: ChannelType.PARTNERS } });
  if (!part) {
    part = await prisma.channel.create({ data: { type: ChannelType.PARTNERS, name: 'Partenaires RISAC' } });
    for (const k of ['superadmin', 'partner', 'national']) {
      await prisma.channelMember.create({ data: { channelId: part.id, userId: users[k] } });
    }
  }

  console.log(`  canaux : ${await prisma.channel.count()}, comptes : ${await prisma.ledgerAccount.count()}`);
}

async function main() {
  console.log('Seed RISAC ...');
  await seedGeography();
  await seedTemplates();
  await seedOrphanages();
  const users = await seedUsers();
  await seedChildren(users);
  await seedAccountsAndChannels(users);
  console.log('Seed termine.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
