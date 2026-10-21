'use client';

import Link from 'next/link';
import { Banknote, FileCheck, Users, Wallet } from 'lucide-react';
import { Stat } from '@/components/ui/Stat';
import { Badge } from '@/components/ui/Badge';
import { AlertRow, CountRow, SectionTitle } from '../widgets';
import { date, money, num } from '@/lib/format';

export function DirectorBoard({ data }: { data: any }) {
  const o = data.orphanage;
  return (
    <>
      {o && (
        <div className="card card-pad flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-ink-900">{o.name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <Badge status={o.labelStatus} />
              {o.labelExpiresAt && <span>label valable jusqu au {date(o.labelExpiresAt)}</span>}
              {!o.accountVerified && (
                <span className="chip bg-amber-50 text-amber-700">compte non vérifié</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-ink-500">Places occupées</p>
            <p className="text-xl font-semibold text-ink-900">
              {num(o.occupiedPlaces)} / {num(o.totalPlaces)}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Enfants accueillis" value={num(data.children.total)} tone="primary" icon={<Users className="h-5 w-5" />} />
        <Stat
          label="Dossiers à finaliser"
          value={num(data.children.draft + data.children.needsCorrection)}
          hint={`${num(data.children.inValidation)} en validation`}
          tone="amber"
          icon={<FileCheck className="h-5 w-5" />}
        />
        <Stat label="Solde disponible" value={money(data.balance.balance)} tone="mint" icon={<Wallet className="h-5 w-5" />} />
        <Stat
          label="Justificatifs attendus"
          value={num(data.disbursements.awaitingReceipts)}
          tone="coral"
          icon={<Banknote className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionTitle
            action={
              <Link href="/enfants/nouveau" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                Nouvel enfant
              </Link>
            }
          >
            Mes dossiers
          </SectionTitle>
          <CountRow label="Brouillons" value={data.children.draft} href="/enfants?status=DRAFT" />
          <CountRow label="En validation" value={data.children.inValidation} href="/enfants?status=IN_VALIDATION" />
          <CountRow label="A corriger" value={data.children.needsCorrection} href="/enfants?status=NEEDS_CORRECTION" />
          <CountRow label="Personnel" value={data.staff} href="/utilisateurs" />
          <CountRow label="Projets" value={data.projects} href="/projets" />
        </section>

        <section className="card card-pad lg:col-span-2">
          <SectionTitle
            action={
              <Link href="/decaissements" className="text-sm font-medium text-risac-600 hover:text-risac-700">
                Tout voir
              </Link>
            }
          >
            Décaissements récents
          </SectionTitle>
          <div className="space-y-2">
            {data.disbursements.recent.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">Aucune demande pour le moment.</p>
            )}
            {data.disbursements.recent.map((d: any) => (
              <Link
                key={d.id}
                href={`/decaissements/${d.id}`}
                className="flex items-start gap-3 rounded-xl border border-ink-100 px-4 py-3 transition-colors hover:border-risac-200 hover:bg-risac-50/40"
              >
                <Badge status={d.status} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">{d.reason}</span>
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {money(d.amount, d.currency)}
                    {d.receipts.length > 0 ? ` - ${d.receipts.length} justificatif(s)` : ''}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {data.overdueUpdates.length > 0 && (
        <section className="card card-pad">
          <SectionTitle>Mises à jour en retard</SectionTitle>
          <div className="space-y-2">
            {data.overdueUpdates.map((a: any, i: number) => (
              <AlertRow
                key={`${a.childId}-${a.kind}-${i}`}
                title={`${a.firstName} (${a.publicId})`}
                detail={a.message}
                href={`/enfants/${a.childId}`}
                tone="amber"
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
