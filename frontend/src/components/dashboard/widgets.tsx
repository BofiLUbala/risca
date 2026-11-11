'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { money, num, percent, relative } from '@/lib/format';

const COLLAPSE_KEY = 'risac.dash.collapsed.v1';
export const COLLAPSE_EVENT = 'risac:dash-collapse';

function readCollapsed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(COLLAPSE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeCollapsed(id: string, collapsed: boolean) {
  try {
    const set = new Set(readCollapsed());
    if (collapsed) set.add(id);
    else set.delete(id);
    window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...set]));
  } catch {
    /* stockage indisponible : l'état reste valable pour la page */
  }
}

/**
 * Titre de carte repliable. Le titre est le premier enfant de la carte ; replier
 * masque tout le reste de la carte (règle CSS `section[data-collapsed]`).
 * L'état est mémorisé par titre, sur cet appareil.
 */
export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const id = typeof children === 'string' ? children : String(children);
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed().includes(id));
    const onAll = (e: Event) => {
      const next = !!(e as CustomEvent<boolean>).detail;
      setCollapsed(next);
      writeCollapsed(id, next);
    };
    window.addEventListener(COLLAPSE_EVENT, onAll);
    return () => window.removeEventListener(COLLAPSE_EVENT, onAll);
  }, [id]);

  useEffect(() => {
    ref.current?.closest('section')?.setAttribute('data-collapsed', String(collapsed));
  }, [collapsed]);

  function toggle() {
    setCollapsed((c) => {
      writeCollapsed(id, !c);
      return !c;
    });
  }

  return (
    <div ref={ref} className="mb-4 flex items-center justify-between gap-3">
      <h2 className="section-title brand-tick min-w-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="-my-2 inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-lg py-2 pr-2 text-left hover:text-risac-700"
        >
          <span className="truncate">{children}</span>
          <ChevronDown
            className={clsx('h-4 w-4 shrink-0 text-ink-500 transition-transform duration-base motion-reduce:transition-none', collapsed && '-rotate-90')}
            aria-hidden="true"
          />
          <span className="sr-only">{collapsed ? 'Développer la section' : 'Réduire la section'}</span>
        </button>
      </h2>
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
          className="h-full rounded-full bg-sun-400 transition-[width] duration-500"
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
      className="flex items-start gap-3 rounded-xl border border-ink-100 bg-surface px-4 py-3 transition-colors hover:border-sun-300 hover:bg-sun-50"
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
