export function money(amount?: number | null, currency = 'USD'): string {
  if (amount === null || amount === undefined) return '-';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function num(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function date(value?: string | Date | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

export function relative(value?: string | Date | null): string {
  if (!value) return '-';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'a l’instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return date(value);
}

export function initials(first?: string, last?: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  IN_VALIDATION: 'En validation',
  NEEDS_CORRECTION: 'À corriger',
  ACTIVE: 'Actif',
  TRANSFERRED: 'Transfere',
  REUNIFIED: 'Réunifié',
  ADOPTED: 'Adopte',
  ADULT: 'Majeur',
  AFTERCARE: 'Suivi apres sortie',
  PUBLISHED: 'Publie',
  FULLY_FUNDED: 'Finance a 100 %',
  IN_EXECUTION: 'En execution',
  COMPLETED: 'Termine',
  CANCELLED: 'Annule',
  REJECTED: 'Refusé',
  FROZEN: 'Gele',
  PENDING: 'En attente',
  APPROVED: 'Valide',
  CHANGES_REQUESTED: 'Corrections demandees',
  REQUESTED: 'Demande',
  AMBASSADOR_CONFIRMED: 'Confirme',
  PAID: 'Paye',
  AWAITING_RECEIPTS: 'Justificatifs attendus',
  SETTLED: 'Solde',
  COMPLIANT: 'Conforme',
  COMPLIANT_WITH_CONDITIONS: 'Conforme sous conditions',
  NON_COMPLIANT: 'Non conforme',
  NONE: 'Non labellise',
  PAUSED: 'En pause',
  OPEN: 'Ouvert',
  RESOLVED: 'Resolu',
};

export function label(status?: string): string {
  if (!status) return '-';
  return STATUS_LABEL[status] ?? status;
}
