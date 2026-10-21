'use client';

import useSWR from 'swr';
import { Info } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { money } from '@/lib/format';

/** Frais de fonctionnement transparents affiches avant le paiement. */
export function FeeBreakdown({ amount, currency }: { amount: number; currency: string }) {
  const { data: quote } = useSWR<any>(
    amount > 0 ? `/payments/quote?amount=${amount}&currency=${currency}` : null,
    fetcher,
  );

  if (!quote) return null;

  return (
    <div className="rounded-xl bg-ink-50 px-4 py-3 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
        <Info className="h-3.5 w-3.5" />
        Transparence des frais
      </p>
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-ink-500">Votre versement</dt>
          <dd className="tabular-nums text-ink-800">{money(quote.amount, quote.currency)}</dd>
        </div>
        {currency !== 'USD' && (
          <div className="flex justify-between">
            <dt className="text-ink-500">Equivalent USD</dt>
            <dd className="tabular-nums text-ink-800">{money(quote.amountUsd)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-500">Frais ({quote.feePercent} %)</dt>
          <dd className="tabular-nums text-ink-800">{money(quote.feeAmount)}</dd>
        </div>
        <div className="flex justify-between border-t border-ink-200 pt-1 font-medium">
          <dt className="text-ink-700">Montant affecté</dt>
          <dd className="tabular-nums text-ink-900">{money(quote.netAmount)}</dd>
        </div>
      </dl>
    </div>
  );
}
