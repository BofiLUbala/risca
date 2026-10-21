export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN_FINANCE'
  | 'MODERATOR'
  | 'ETHICS_AUDITOR'
  | 'NATIONAL_MANAGER'
  | 'REGIONAL_MANAGER'
  | 'AMBASSADOR'
  | 'FIELD_AGENT'
  | 'ORPHANAGE_DIRECTOR'
  | 'ORPHANAGE_STAFF'
  | 'DONOR'
  | 'PARTNER';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_FINANCE: 'Admin Finance',
  MODERATOR: 'Modérateur / Support',
  ETHICS_AUDITOR: 'Auditeur Éthique',
  NATIONAL_MANAGER: 'Responsable National',
  REGIONAL_MANAGER: 'Chef Régional',
  AMBASSADOR: 'Ambassadeur',
  FIELD_AGENT: 'Agent de terrain',
  ORPHANAGE_DIRECTOR: "Chef d'orphelinat",
  ORPHANAGE_STAFF: "Personnel de l'orphelinat",
  DONOR: 'Bailleur de fonds',
  PARTNER: 'Partenaire',
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  IN_VALIDATION: 'En validation',
  NEEDS_CORRECTION: 'À corriger',
  ACTIVE: 'Actif',
  TRANSFERRED: 'Transféré',
  REUNIFIED: 'Réunifié en famille',
  ADOPTED: 'Adopté',
  ADULT: 'Majeur',
  AFTERCARE: 'Sorti (suivi)',
  DECEASED: 'Décédé',
  MISSING: 'Disparu',
  PUBLISHED: 'Publié',
  FULLY_FUNDED: 'Financé à 100 %',
  IN_EXECUTION: 'En exécution',
  COMPLETED: 'Terminé',
  CLOSED: 'Clôturé',
  CANCELLED: 'Annulé',
  REJECTED: 'Refusé',
  FROZEN: 'Gelé',
  PROPOSED: 'Proposé',
  REGIONAL_REVIEW: 'Vérification régionale',
  APPROVED: 'Validé',
  SUSPENDED: 'Suspendu',
  INVITED: 'Invité',
  BLOCKED: 'Bloqué',
  PENDING: 'En attente',
  SUCCEEDED: 'Réglé',
  FAILED: 'Échoué',
  REFUNDED: 'Remboursé',
  CHANGES_REQUESTED: 'Corrections demandées',
  REQUESTED: 'Demandé',
  AMBASSADOR_CONFIRMED: 'Confirmé par l’ambassadeur',
  PAID: 'Payé',
  AWAITING_RECEIPTS: 'Justificatifs attendus',
  SETTLED: 'Soldé',
  NONE: 'Non labellisé',
  APPLIED: 'Candidature déposée',
  AUDIT_SCHEDULED: 'Audit planifié',
  COMPLIANT: 'Conforme',
  COMPLIANT_WITH_CONDITIONS: 'Conforme sous conditions',
  NON_COMPLIANT: 'Non conforme',
  EXPIRED: 'Label expiré',
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  PAUSED: 'En pause',
};

export function statusTone(status?: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'COMPLIANT':
    case 'PUBLISHED':
    case 'SETTLED':
    case 'PAID':
    case 'SUCCEEDED':
    case 'RESOLVED':
      return 'bg-emerald-50 text-emerald-700';
    case 'IN_VALIDATION':
    case 'PENDING':
    case 'REQUESTED':
    case 'AMBASSADOR_CONFIRMED':
    case 'AUDIT_SCHEDULED':
    case 'APPLIED':
    case 'IN_PROGRESS':
      return 'bg-risac-50 text-risac-700';
    case 'NEEDS_CORRECTION':
    case 'CHANGES_REQUESTED':
    case 'COMPLIANT_WITH_CONDITIONS':
    case 'AWAITING_RECEIPTS':
    case 'REFUNDED':
    case 'PAUSED':
      return 'bg-amber-50 text-amber-700';
    case 'REJECTED':
    case 'BLOCKED':
    case 'NON_COMPLIANT':
    case 'FROZEN':
    case 'CANCELLED':
    case 'FAILED':
    case 'DECEASED':
    case 'MISSING':
      return 'bg-rose-50 text-rose-700';
    case 'DRAFT':
    default:
      return 'bg-ink-100 text-ink-600';
  }
}

export function label(status?: string): string {
  if (!status) return '—';
  return STATUS_LABEL[status] ?? status;
}
