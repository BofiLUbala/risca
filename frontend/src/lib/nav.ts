import type { Role } from './roles';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  group: string;
}

/**
 * Navigation des fonctionnalites, a gauche du tableau de bord.
 * Chaque entree est filtree par role (section 11 du plan).
 */
export const NAV: NavItem[] = [
  { href: '/tableau-de-bord', label: 'Vue d’ensemble', icon: 'LayoutDashboard', group: 'Pilotage', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'MODERATOR', 'ETHICS_AUDITOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'FIELD_AGENT', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'DONOR', 'PARTNER'] },

  { href: '/enfants', label: 'Enfants', icon: 'Users', group: 'Suivi', roles: ['SUPER_ADMIN', 'ETHICS_AUDITOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'FIELD_AGENT', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF'] },
  { href: '/orphelinats', label: 'Orphelinats', icon: 'Home', group: 'Suivi', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'ETHICS_AUDITOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'FIELD_AGENT', 'ORPHANAGE_DIRECTOR'] },
  { href: '/projets', label: 'Projets', icon: 'Target', group: 'Suivi', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'ETHICS_AUDITOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'DONOR', 'PARTNER'] },
  { href: '/validations', label: 'Validations', icon: 'CheckCircle2', group: 'Suivi', roles: ['SUPER_ADMIN', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR'] },

  { href: '/communication', label: 'Espace de communication', icon: 'Newspaper', group: 'Réseau', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'MODERATOR', 'ETHICS_AUDITOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'FIELD_AGENT', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'DONOR', 'PARTNER'] },
  { href: '/messages', label: 'Messagerie', icon: 'MessageCircle', group: 'Réseau', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'MODERATOR', 'ETHICS_AUDITOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'FIELD_AGENT', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'DONOR', 'PARTNER'] },

  { href: '/finance', label: 'Flux financiers', icon: 'Wallet', group: 'Argent', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'ETHICS_AUDITOR'] },
  { href: '/decaissements', label: 'Décaissements', icon: 'Banknote', group: 'Argent', roles: ['SUPER_ADMIN', 'ADMIN_FINANCE', 'ETHICS_AUDITOR', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'REGIONAL_MANAGER', 'NATIONAL_MANAGER'] },
  { href: '/mes-dons', label: 'Mes dons', icon: 'HeartHandshake', group: 'Argent', roles: ['DONOR', 'PARTNER'] },
  { href: '/mes-parrainages', label: 'Mes parrainages', icon: 'Sparkles', group: 'Argent', roles: ['DONOR', 'PARTNER'] },

  { href: '/moderation', label: 'Modération', icon: 'ShieldAlert', group: 'Gouvernance', roles: ['SUPER_ADMIN', 'MODERATOR', 'ETHICS_AUDITOR'] },
  { href: '/support', label: 'Support', icon: 'LifeBuoy', group: 'Gouvernance', roles: ['SUPER_ADMIN', 'MODERATOR', 'ADMIN_FINANCE', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'AMBASSADOR', 'ORPHANAGE_DIRECTOR', 'ORPHANAGE_STAFF', 'FIELD_AGENT', 'DONOR', 'PARTNER'] },
  { href: '/journal-audit', label: 'Journal d’audit', icon: 'ScrollText', group: 'Gouvernance', roles: ['SUPER_ADMIN', 'ETHICS_AUDITOR'] },

  { href: '/utilisateurs', label: 'Utilisateurs', icon: 'UserCog', group: 'Administration', roles: ['SUPER_ADMIN', 'MODERATOR', 'NATIONAL_MANAGER', 'REGIONAL_MANAGER', 'ORPHANAGE_DIRECTOR'] },
  { href: '/modeles-dossier', label: 'Modèles de dossier', icon: 'FileCog', group: 'Administration', roles: ['SUPER_ADMIN', 'NATIONAL_MANAGER'] },
  { href: '/parametres', label: 'Paramètres', icon: 'Settings', group: 'Administration', roles: ['SUPER_ADMIN'] },
];

export const GROUP_ORDER = ['Pilotage', 'Suivi', 'Réseau', 'Argent', 'Gouvernance', 'Administration'];

export function navForRole(role: Role): Record<string, NavItem[]> {
  const items = NAV.filter((n) => n.roles.includes(role));
  const grouped: Record<string, NavItem[]> = {};
  for (const item of items) {
    (grouped[item.group] ??= []).push(item);
  }
  return grouped;
}
