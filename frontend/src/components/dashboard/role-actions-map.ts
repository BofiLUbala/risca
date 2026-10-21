import type { Role } from '@/lib/roles';

export interface RoleAction {
  href: string;
  label: string;
  hint: string;
  icon: string;
}

/** Fonctionnalites de chaque acteur, section 11 du plan fonctionnel. */
export const ROLE_ACTIONS: Record<Role, RoleAction[]> = {
  SUPER_ADMIN: [
    { href: '/utilisateurs', label: 'Inviter et gérer les comptes', hint: 'Bloquer, suspendre, avertir, forcer la deconnexion', icon: 'UserCog' },
    { href: '/orphelinats', label: 'Valider orphelinats et labellisations', hint: 'Candidatures, audits, badges', icon: 'BadgeCheck' },
    { href: '/modeles-dossier', label: 'Modèles de dossier par pays', hint: 'Créer et modifier champs et documents', icon: 'FileCog' },
    { href: '/moderation', label: 'Moderer canaux et publications', hint: 'Signalements et contenus masques', icon: 'ShieldAlert' },
    { href: '/notifications', label: 'Notifications ciblees', hint: 'Tous, pays, rôle ou région', icon: 'BellRing' },
    { href: '/journal-audit', label: 'Journal d’audit', hint: 'Qui a consulte ou modifie quoi', icon: 'ScrollText' },
    { href: '/parametres', label: 'Paramètres du réseau', hint: 'Seuils, frais, devises, categories', icon: 'Settings' },
    { href: '/finance', label: 'Flux financiers', hint: 'Comptes, dons, rapprochement', icon: 'Wallet' },
  ],
  ADMIN_FINANCE: [
    { href: '/decaissements', label: 'File des décaissements', hint: 'Approuver ou refuser les demandes', icon: 'Banknote' },
    { href: '/finance', label: 'Rapprochement des paiements', hint: 'Confirmations des fournisseurs', icon: 'RefreshCw' },
    { href: '/orphelinats', label: 'Vérifier les comptes', hint: 'Un compte non vérifié bloque les paiements', icon: 'BadgeCheck' },
  ],
  MODERATOR: [
    { href: '/moderation', label: 'File des signalements', hint: 'Masquer, avertir, classer', icon: 'ShieldAlert' },
    { href: '/support', label: 'Tickets de support', hint: 'Activation, mot de passe, paiement', icon: 'LifeBuoy' },
    { href: '/messages', label: 'Canaux moderes', hint: 'Consulter et moderer tous les canaux', icon: 'MessageCircle' },
    { href: '/communication', label: 'Publications signalées', hint: 'Masquer ou retablir', icon: 'Newspaper' },
  ],
  ETHICS_AUDITOR: [
    { href: '/moderation', label: 'Signalements graves', hint: 'Maltraitance, fraude', icon: 'ShieldAlert' },
    { href: '/journal-audit', label: 'Journal d’audit complet', hint: 'Lecture seule sur tout le réseau', icon: 'ScrollText' },
    { href: '/finance', label: 'Flux d’argent', hint: 'Comptes et rapprochement', icon: 'Wallet' },
    { href: '/enfants', label: 'Dossiers et consentements', hint: 'Controle de conformité', icon: 'Users' },
  ],
  NATIONAL_MANAGER: [
    { href: '/utilisateurs?role=REGIONAL_MANAGER', label: 'Gérer les chefs regionaux', hint: 'Inviter et suivre', icon: 'UserCog' },
    { href: '/orphelinats', label: 'Structures du pays', hint: 'Labellisation et audits', icon: 'Home' },
    { href: '/modeles-dossier', label: 'Modèle de dossier du pays', hint: 'Si delegue par le Super Admin', icon: 'FileCog' },
    { href: '/notifications', label: 'Notifications au pays', hint: 'Diffusion ciblee', icon: 'BellRing' },
  ],
  REGIONAL_MANAGER: [
    { href: '/validations', label: 'File de validation', hint: 'Dossiers, projets, orphelinats, fiches', icon: 'CheckCircle2' },
    { href: '/utilisateurs?role=AMBASSADOR', label: 'Ambassadeurs et agents', hint: 'Inviter et suivre la performance', icon: 'UserCog' },
    { href: '/orphelinats', label: 'Audits et transferts', hint: 'Planning des audits, transferts', icon: 'Home' },
    { href: '/enfants', label: 'Dossiers de la région', hint: 'Complétude, post-majorite', icon: 'Users' },
  ],
  AMBASSADOR: [
    { href: '/enfants', label: 'Mes enfants', hint: 'Dossier, historique, mise à jour, publication', icon: 'Users' },
    { href: '/validations', label: 'Ma file de validation', hint: 'Dossiers, propositions, projets', icon: 'CheckCircle2' },
    { href: '/decaissements', label: 'Confirmer les décaissements', hint: 'Vous confirmez le besoin, jamais le paiement', icon: 'Banknote' },
    { href: '/communication', label: 'Publier pour mes enfants', hint: 'Nouvelle, besoin urgent, appel au parrainage', icon: 'Newspaper' },
    { href: '/projets', label: 'Projets de mes enfants', hint: 'Créer et suivre les collectes', icon: 'Target' },
    { href: '/messages', label: 'Repondre aux bailleurs', hint: 'Canal modere, sans coordonnees', icon: 'MessageCircle' },
  ],
  FIELD_AGENT: [
    { href: '/enfants/nouveau', label: 'Recenser un enfant', hint: 'Soumis a validation', icon: 'UserPlus' },
    { href: '/orphelinats/nouveau', label: 'Proposer un orphelinat', hint: 'Vérifié par le chef regional', icon: 'Home' },
    { href: '/support', label: 'Signaler une urgence', hint: 'Au chef regional', icon: 'LifeBuoy' },
  ],
  ORPHANAGE_DIRECTOR: [
    { href: '/enfants/nouveau', label: 'Nouvel enfant', hint: 'Formulaire adapte au pays', icon: 'UserPlus' },
    { href: '/enfants', label: 'Mes dossiers', hint: 'Brouillons, en validation, à corriger', icon: 'Users' },
    { href: '/projets/nouveau', label: 'Créer un projet', hint: 'Enfant ou orphelinat', icon: 'Target' },
    { href: '/decaissements', label: 'Demander un décaissement', hint: 'Puis televerser les justificatifs', icon: 'Banknote' },
    { href: '/utilisateurs', label: 'Gestion du personnel', hint: 'Psychologue, educateur, infirmier', icon: 'UserCog' },
  ],
  ORPHANAGE_STAFF: [
    { href: '/enfants', label: 'Enfants de la structure', hint: 'Selon votre fonction', icon: 'Users' },
  ],
  DONOR: [
    { href: '/enfants-a-soutenir', label: 'Decouvrir les enfants', hint: 'Financer ou parrainer', icon: 'HeartHandshake' },
    { href: '/mes-parrainages', label: 'Mes parrainages', hint: 'Modifier, mettre en pause, annuler', icon: 'Sparkles' },
    { href: '/mes-dons', label: 'Mes dons et reçus', hint: 'Preuves de dépense', icon: 'Wallet' },
    { href: '/messages', label: 'Écrire à l’ambassadeur', hint: 'Jamais directement a l’enfant', icon: 'MessageCircle' },
  ],
  PARTNER: [
    { href: '/projets', label: 'Projets co-finances', hint: 'Suivi des collectes', icon: 'Target' },
    { href: '/mes-dons', label: 'Mes contributions', hint: 'Reçus et preuves', icon: 'Wallet' },
    { href: '/messages', label: 'Canal partenaires', hint: 'Avec les administrateurs', icon: 'MessageCircle' },
    { href: '/profil', label: 'Fiche de mon organisation', hint: 'Visible dans la liste publique', icon: 'Building' },
  ],
};
