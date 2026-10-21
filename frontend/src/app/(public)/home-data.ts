import { BadgeCheck, HeartHandshake, ShieldCheck, Users } from 'lucide-react';

export const AXES = [
  {
    icon: ShieldCheck,
    title: 'Qualite des soins et traumatismes de guerre',
    text: 'Volet psychotrauma du dossier enfant, orientation FONAREV, suivi du placement familial, labellisation des structures.',
  },
  {
    icon: Users,
    title: 'Capacites, numerisation, Academie',
    text: 'Plateforme de suivi des dossiers, certificats de vulnerabilite, personnel certifie.',
  },
  {
    icon: HeartHandshake,
    title: 'Plaidoyer, partenariats, Global Congo Children Fund',
    text: 'Espace de communication, rôles Bailleur et Partenaire, fonds général, rapports exportables.',
  },
  {
    icon: BadgeCheck,
    title: 'Post-majorite, Tremplin vers l’Avenir',
    text: 'Preparation des 16 ans, bourse Tremplin, mentorat et suivi apres la sortie.',
  },
];

export const CIRCUIT = [
  { n: '1', t: 'Vous payez', d: 'Page de paiement securisee : mobile money, carte ou PayPal.' },
  { n: '2', t: 'Compte central', d: 'Le montant est affecté a l’enfant, au projet ou au fonds général.' },
  { n: '3', t: 'Décaissement validé', d: 'La structure demande, l’ambassadeur confirme, l’Admin Finance paie.' },
  { n: '4', t: 'Preuve de dépense', d: 'Les factures et photos remontent jusqu à votre espace.' },
];
