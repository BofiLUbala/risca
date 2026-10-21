'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Lock, XCircle } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { Logo } from '@/components/ui/Logo';
import { Spinner } from '@/components/ui/Loading';

/**
 * Page de paiement web lancee depuis l application (section 10.2).
 * En bac a sable, elle simule la confirmation du fournisseur via le webhook.
 */
export default function CheckoutPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const search = useSearchParams();
  const amount = search.get('amount');
  const currency = search.get('currency') ?? 'USD';
  const provider = search.get('provider') ?? 'FLUTTERWAVE';

  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  async function confirm(status: 'SUCCESS' | 'FAILED') {
    setState('busy');
    await fetch(`${API_URL}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, status, providerRef: `${provider}-${Date.now()}` }),
    });
    setState(status === 'SUCCESS' ? 'done' : 'failed');
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="chip bg-emerald-50 text-emerald-700">
            <Lock className="h-3 w-3" />
            Page sécurisée
          </span>
        </div>

        {state === 'done' ? (
          <div className="mt-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-4 text-lg font-semibold text-ink-950">Paiement confirmé</h1>
            <p className="mt-2 text-sm text-ink-500">
              Merci. Votre reçu est disponible dans votre espace, et votre don est deja affecte.
            </p>
            <Link href="/mes-dons" className="btn-primary mt-6 w-full py-3">
              Voir mes dons
            </Link>
          </div>
        ) : state === 'failed' ? (
          <div className="mt-8 text-center">
            <XCircle className="mx-auto h-12 w-12 text-rose-500" />
            <h1 className="mt-4 text-lg font-semibold text-ink-950">Paiement refuse</h1>
            <p className="mt-2 text-sm text-ink-500">
              Aucun montant n a ete preleve. Vous pouvez reessayer depuis votre espace.
            </p>
            <Link href="/mes-dons" className="btn-outline mt-6 w-full py-3">
              Retour à mes dons
            </Link>
          </div>
        ) : (
          <CheckoutForm
            reference={reference}
            provider={provider}
            amount={amount}
            currency={currency}
            busy={state === 'busy'}
            onConfirm={confirm}
          />
        )}
      </div>
    </div>
  );
}

function CheckoutForm({
  reference,
  provider,
  amount,
  currency,
  busy,
  onConfirm,
}: {
  reference: string;
  provider: string;
  amount: string | null;
  currency: string;
  busy: boolean;
  onConfirm: (s: 'SUCCESS' | 'FAILED') => void;
}) {
  return (
    <>
      <h1 className="mt-8 text-lg font-semibold text-ink-950">Confirmer votre paiement</h1>
      <dl className="mt-4 space-y-2 rounded-xl bg-ink-50 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-500">Référence</dt>
          <dd className="font-mono text-xs text-ink-800">{reference}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-500">Fournisseur</dt>
          <dd className="text-ink-800">{provider}</dd>
        </div>
        {amount && (
          <div className="flex justify-between border-t border-ink-200 pt-2 font-medium">
            <dt className="text-ink-700">Montant</dt>
            <dd className="text-ink-900">
              {amount} {currency}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Mode bac à sable : aucune clé de fournisseur n’est configurée. Les boutons ci-dessous
        simulent la confirmation envoyee par le fournisseur de paiement.
      </p>

      <div className="mt-6 space-y-2">
        <button onClick={() => onConfirm('SUCCESS')} disabled={busy} className="btn-primary w-full py-3">
          {busy ? <Spinner className="h-4 w-4" /> : null}
          Payer maintenant
        </button>
        <button onClick={() => onConfirm('FAILED')} disabled={busy} className="btn-ghost w-full py-3">
          Simuler un échec
        </button>
      </div>
    </>
  );
}
