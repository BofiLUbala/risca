import { t, intlLocale } from '@/lib/i18n';
export function money(amount?: number | null, currency = 'USD'): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function num(value?: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(intlLocale()).format(value);
}

export function date(value?: string | Date | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium' }).format(new Date(value));
}

export function dateTime(value?: string | Date | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function relative(value?: string | Date | null): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return t("a l'instant");
  if (mins < 60) return t("il y a {mins} min", { mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("il y a {hours} h", { hours });
  const days = Math.round(hours / 24);
  if (days < 30) return t("il y a {days} j", { days });
  return date(value);
}

export function initials(first?: string, last?: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}
