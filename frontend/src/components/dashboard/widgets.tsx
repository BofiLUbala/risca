'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { Badge } from '@/components/ui/Badge';
import { money, num, percent, relative } from '@/lib/format';

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="section-title">{children}</h2>
      {action}
    </div>
  );
}

export function Progress({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = percent(value, total);
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-risac-400 to-risac-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {label && (
        <p className="mt-1.5 text-xs text-ink-500">
          {label} &middot; {pct} %
        </p>
      )}
    </div>
  );
}

export function AlertRow({
  title,
  detail,
  tone = 'amber',
  href,
}: {
  title: string;
  detail?: string;
  tone?: 'amber' | 'coral' | 'primary';
  href?: string;
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50/70',
    coral: 'border-rose-200 bg-rose-50/70',
    primary: 'border-risac-200 bg-risac-50/70',
  };
  const Wrapper: any = href ? Link : 'div';
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={clsx(
        'block rounded-xl border px-4 py-3 transition-colors',
        tones[tone],
        href && 'hover:brightness-[0.98]',
      )}
    >
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {detail && <p className="mt-0.5 text-xs text-ink-500">{detail}</p>}
    </Wrapper>
  );
}

export function MoneyRow({
  label,
  value,
  currency = 'USD',
  strong,
}: {
  label: string;
  value: number;
  currency?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0">
      <span className="text-sm text-ink-600">{label}</span>
      <span className={clsx('tabular-nums', strong ? 'text-base font-semibold text-ink-900' : 'text-sm text-ink-800')}>
        {money(value, currency)}
      </span>
    </div>
  );
}

export function CountRow({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href?: string;
  /** Précision affichée sous le chiffre, par exemple le total de référence. */
  hint?: string;
}) {
  const Wrapper: any = href ? Link : 'div';
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="flex items-center justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0"
    >
      <span className="text-sm text-ink-600">{label}</span>
      <span className="text-right">
        <span className="block text-sm font-semibold tabular-nums text-ink-900">{num(value)}</span>
        {hint && <span className="meta">{hint}</span>}
      </span>
    </Wrapper>
  );
}

export function QueueItem({ request }: { request: any }) {
  const current = request.steps?.find((s: any) => s.order === request.currentStepOrder);
  return (
    <Link
      href={`/validations/${request.id}`}
      className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 transition-colors hover:border-risac-200 hover:bg-risac-50/40"
    >
      <span className="mt-0.5">
        <Badge status={request.status} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-800">
          {request.entityLabel ?? request.kind}
        </span>
        <span className="mt-0.5 block text-xs text-ink-400">
          {relative(request.createdAt)}
          {current ? ` · étape ${current.order}` : ''}
          {request.escalated ? ' · remonte au niveau superieur' : ''}
        </span>
      </span>
    </Link>
  );
}
