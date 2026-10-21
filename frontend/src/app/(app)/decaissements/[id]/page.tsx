'use client';

import { use } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowLeft, FileCheck } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Loading';
import { Field } from '@/components/child/Tabs';
import { date, dateTime, money } from '@/lib/format';

const STEPS = [
  { key: 'REQUESTED', label: '1. Demande du chef d’orphelinat' },
  { key: 'AMBASSADOR_CONFIRMED', label: '2. Besoin confirmé par l’ambassadeur' },
  { key: 'AWAITING_RECEIPTS', label: '3. Paiement par l’Admin Finance' },
  { key: 'SETTLED', label: '4. Justificatifs reçus, dépense soldée' },
];

const ORDER = ['REQUESTED', 'AMBASSADOR_CONFIRMED', 'AWAITING_RECEIPTS', 'SETTLED'];

export default function DisbursementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: d, isLoading } = useSWR<any>(`/disbursements/${id}`, fetcher);

  if (isLoading || !d) return <PageLoading />;
  const current = ORDER.indexOf(d.status);

  return (
    <div className="max-w-3xl space-y-5">
      <Link
        href="/decaissements"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux décaissements
      </Link>

      <header className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">{d.reason}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {d.reference} - {d.orphanage.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums text-ink-900">
              {money(d.amount, d.currency)}
            </p>
            <Badge status={d.status} />
          </div>
        </div>
      </header>

      <section className="card card-pad">
        <h2 className="mb-4 card-title">
          Circuit de l’argent - séparation des pouvoirs
        </h2>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                  i <= current ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-400'
                }`}
              >
                {i + 1}
              </span>
              <span className={i <= current ? 'text-sm text-ink-800' : 'text-sm text-ink-400'}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">Détail</h2>
        <dl>
          <Field
            label="Demande par"
            value={`${d.requestedBy.firstName} ${d.requestedBy.lastName} - ${date(d.createdAt)}`}
          />
          <Field label="Confirme le" value={d.confirmedAt ? dateTime(d.confirmedAt) : null} />
          <Field label="Paye le" value={d.paidAt ? dateTime(d.paidAt) : null} />
          <Field label="Moyen de paiement" value={d.payoutMethod} />
          <Field label="Référence du paiement" value={d.payoutRef} />
          <Field label="Projet" value={d.project?.title} />
          {d.rejectionReason ? <Field label="Motif du refus" value={d.rejectionReason} /> : null}
        </dl>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 card-title">Justificatifs</h2>
        {!d.receipts?.length ? (
          <p className="text-sm text-ink-400">
            Aucun justificatif. Les factures, photos ou videos sont obligatoires.
          </p>
        ) : (
          <ul className="space-y-2">
            {d.receipts.map((r: any) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm text-ink-800">
                  <FileCheck className="h-4 w-4 text-ink-400" />
                  {r.name}
                </span>
                <span className="text-sm tabular-nums text-ink-600">
                  {r.amount ? money(r.amount) : r.kind}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
