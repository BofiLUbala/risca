import { FieldType, Visibility } from '@prisma/client';

export interface SeedField {
  key: string;
  labelFr: string;
  labelEn: string;
  type: FieldType;
  required?: boolean;
  visibility?: Visibility;
  options?: string[];
  helpText?: string;
}

export interface SeedSection {
  key: string;
  labelFr: string;
  labelEn: string;
  visibility: Visibility;
  fields: SeedField[];
}

/** Partie commune a tous les pays (section 5.2 du plan). */
const COMMON_SECTIONS: SeedSection[] = [
  {
    key: 'identite',
    labelFr: 'Identite',
    labelEn: 'Identity',
    visibility: Visibility.CONFIDENTIAL,
    fields: [
      { key: 'lieu_naissance', labelFr: 'Lieu de naissance', labelEn: 'Place of birth', type: FieldType.TEXT },
      { key: 'nationalite', labelFr: 'Nationalite', labelEn: 'Nationality', type: FieldType.TEXT },
      {
        key: 'langues_parlees',
        labelFr: 'Langues parlees',
        labelEn: 'Spoken languages',
        type: FieldType.MULTISELECT,
        options: ['Francais', 'Anglais', 'Swahili', 'Lingala', 'Tshiluba', 'Kikongo'],
      },
      { key: 'photo_identite', labelFr: 'Photo d identite', labelEn: 'ID photo', type: FieldType.PHOTO },
    ],
  },
  {
    key: 'famille',
    labelFr: 'Famille',
    labelEn: 'Family',
    visibility: Visibility.CONFIDENTIAL,
    fields: [
      {
        key: 'statut_pere',
        labelFr: 'Pere',
        labelEn: 'Father',
        type: FieldType.SELECT,
        options: ['Vivant', 'Decede', 'Inconnu'],
        required: true,
      },
      {
        key: 'statut_mere',
        labelFr: 'Mere',
        labelEn: 'Mother',
        type: FieldType.SELECT,
        options: ['Vivante', 'Decedee', 'Inconnue'],
        required: true,
      },
      { key: 'fratrie', labelFr: 'Fratrie', labelEn: 'Siblings', type: FieldType.LONGTEXT },
      { key: 'tuteur_nom', labelFr: 'Nom du tuteur', labelEn: 'Guardian name', type: FieldType.TEXT },
      { key: 'famille_elargie', labelFr: 'Famille elargie', labelEn: 'Extended family', type: FieldType.LONGTEXT },
    ],
  },
  {
    key: 'vulnerabilite',
    labelFr: 'Vulnerabilite',
    labelEn: 'Vulnerability',
    visibility: Visibility.CONFIDENTIAL,
    fields: [
      {
        key: 'categorie',
        labelFr: 'Categorie principale',
        labelEn: 'Main category',
        type: FieldType.SELECT,
        required: true,
        options: [
          'Orphelin de guerre',
          'Deplace',
          'Abandonne',
          'Enfant des rues',
          'Ancien enfant associe aux groupes armes',
        ],
      },
      { key: 'recit_vulnerabilite', labelFr: 'Contexte', labelEn: 'Context', type: FieldType.LONGTEXT },
    ],
  },
  {
    key: 'placement',
    labelFr: 'Placement',
    labelEn: 'Placement',
    visibility: Visibility.CONFIDENTIAL,
    fields: [
      { key: 'date_admission', labelFr: 'Date d admission', labelEn: 'Admission date', type: FieldType.DATE, required: true },
      { key: 'motif', labelFr: 'Motif', labelEn: 'Reason', type: FieldType.LONGTEXT, required: true },
      { key: 'refere_par', labelFr: 'Refere par', labelEn: 'Referred by', type: FieldType.TEXT },
    ],
  },
];

/** Champs specifiques a la RDC (acte de naissance, FONAREV, DIVAS...). */
const CD_EXTRA: Record<string, SeedField[]> = {
  identite: [
    {
      key: 'acte_naissance',
      labelFr: 'Acte de naissance ou jugement suppletif',
      labelEn: 'Birth certificate or supplementary judgement',
      type: FieldType.FILE,
      required: true,
    },
    { key: 'territoire_origine', labelFr: 'Territoire d origine', labelEn: 'Territory of origin', type: FieldType.TEXT },
    { key: 'chefferie_origine', labelFr: 'Chefferie d origine', labelEn: 'Chiefdom of origin', type: FieldType.TEXT },
  ],
  famille: [
    { key: 'attestation_orphelin', labelFr: 'Attestation d orphelin', labelEn: 'Orphan certificate', type: FieldType.FILE },
  ],
  vulnerabilite: [
    {
      key: 'certificat_vulnerabilite',
      labelFr: 'Certificat de vulnerabilite',
      labelEn: 'Vulnerability certificate',
      type: FieldType.FILE,
      required: true,
    },
    {
      key: 'zone_conflit',
      labelFr: 'Zone de conflit',
      labelEn: 'Conflict zone',
      type: FieldType.SELECT,
      options: ['Nord-Kivu', 'Sud-Kivu', 'Ituri', 'Maniema', 'Aucune'],
    },
  ],
  placement: [
    {
      key: 'decision_juge',
      labelFr: 'Decision du juge pour enfants ou de la DIVAS',
      labelEn: 'Decision of the juvenile judge or DIVAS',
      type: FieldType.FILE,
      required: true,
    },
  ],
};

/** Volet Reparation / FONAREV, specifique a la RDC (Axe 1). */
const CD_REPARATION: SeedSection = {
  key: 'reparation',
  labelFr: 'Reparation (FONAREV)',
  labelEn: 'Reparation (FONAREV)',
  visibility: Visibility.CONFIDENTIAL,
  fields: [
    {
      key: 'statut_orientation',
      labelFr: 'Statut de l orientation',
      labelEn: 'Referral status',
      type: FieldType.SELECT,
      options: ['Identifie', 'Oriente', 'Dossier depose', 'Reparation obtenue'],
    },
    { key: 'numero_dossier', labelFr: 'Numero de dossier', labelEn: 'File number', type: FieldType.TEXT },
    { key: 'demarches', labelFr: 'Demarches effectuees', labelEn: 'Steps taken', type: FieldType.LONGTEXT },
  ],
};

export function buildTemplate(iso2: string): SeedSection[] {
  const sections = COMMON_SECTIONS.map((s) => ({
    ...s,
    fields: [...s.fields, ...(iso2 === 'CD' ? CD_EXTRA[s.key] ?? [] : [])],
  }));

  if (iso2 === 'CD') {
    sections.splice(3, 0, CD_REPARATION);
  } else {
    sections.splice(3, 0, {
      key: 'reparation',
      labelFr: 'Mecanisme national de reparation',
      labelEn: 'National reparation mechanism',
      visibility: Visibility.CONFIDENTIAL,
      fields: [
        { key: 'mecanisme', labelFr: 'Mecanisme (si existant)', labelEn: 'Mechanism (if any)', type: FieldType.TEXT },
        { key: 'statut', labelFr: 'Statut', labelEn: 'Status', type: FieldType.TEXT },
      ],
    });
  }

  return sections;
}
