'use client';

import Link from 'next/link';
import * as Icons from 'lucide-react';
import type { Role } from '@/lib/roles';
import { ROLE_ACTIONS } from './role-actions-map';

function Icon({ name }: { name: string }) {
  const C = (Icons as any)[name] ?? Icons.Circle;
  return <C className="h-[18px] w-[18px]" strokeWidth={1.75} />;
}

/** Les fonctionnalites du role (section 11), directement dans son tableau de bord. */
export function RoleActions({ role }: { role: Role }) {
  const actions = ROLE_ACTIONS[role] ?? [];
  if (!actions.length) return null;

  return (
    <section>
      <h2 className="mb-4 section-title">Mes fonctionnalités</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="card flex items-start gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-risac-200 hover:shadow-lift"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-risac-50 text-risac-600">
              <Icon name={a.icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-900">{a.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{a.hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
