'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { ExternalLink } from 'lucide-react';
import { api, fetcher } from '@/lib/api';
import { Spinner } from '@/components/ui/Loading';
import { money } from '@/lib/format';
import { FeeBreakdown } from './FeeBreakdown';

const PRESETS = [10, 25, 50, 100];

const SCOPES = [
  { value: 'FULL', label: 'Soutien complet' },
  { value: 'EDUCATION', label: 'Etudes' },
  { value: 'HEALTH', label: 'Santé' },
  { value: 'LIVING', label: 'Vie quotidienne' },
];

const RULES = [
  { value: 'FIXED_MONTHS', label: '12 mois' },
  { value: 'UNTIL_18', label: 'Jusqu a 18 ans' },
  { value: 'END_OF_STUDIES', label: 'Fin des études' },
];

/**
 * Les frais sont affiches avant le paiement (section 10.4).
 * Le paiement s ouvre sur une page web securisee, jamais en achat integre.
 */
export function DonatePanel({
  mode,
  childId,
  projectId,
  childName,
}: {
  mode: 'ONE_OFF' | 'SPONSORSHIP' | 'PROJECT_CONTRIBUTION' | 'GENERAL_FUND';
  childId?: string;
  projectId?: string;
  childName?: string;
}) {
  const [amount, setAmount] = useState(25);
  const [currency, setCurrency] = useState('USD');
  const [provider, setProvider] = useState('');
  const [scope, setScope] = useState('FULL');
  const [endRule, setEndRule] = useState('FIXED_MONTHS');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const { data: methods } = useSWR<any[]>('/payments/methods', fetcher);

  useEffect(() => {
    if (!provider && methods?.length) setProvider(methods[0].provider);
  }, [methods, provider]);

  async function submit() {
    setBusy(true);
    setError(null);
    setCheckoutUrl(null);
    try {
      if (mode === 'SPONSORSHIP') {
        const r = await api.post<any>('/payments/sponsorships', {
          childId,
          monthlyAmount: amount,
          currency,
          scope,
          endRule,
          months: endRule === 'FIXED_MONTHS' ? 12 : undefined,
          provider,
        });
        setCheckoutUrl(r.firstPayment?.checkout?.checkoutUrl ?? null);
      } else {
        const r = await api.post<any>('/payments/donations', {
          kind: mode,
          amount,
          currency,
          childId,
          projectId,
          provider,
        });
        setCheckoutUrl(r.checkout?.checkoutUrl ?? null);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Paiement impossible');
    }
    setBusy(false);
  }

  if (checkoutUrl) {
    return (
      <div className="mt-5 space-y-3 rounded-xl bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-800">Votre paiement est pret.</p>
        <p className="text-xs text-emerald-700">
          Il s’ouvre sur une page web sécurisée du fournisseur de paiement.
        </p>
        <a href={checkoutUrl} target="_blank" rel="noreferrer" className="btn-primary w-full">
          <ExternalLink className="h-4 w-4" />
          Ouvrir la page de paiement
        </a>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div>
        <label className="label">
          {mode === 'SPONSORSHIP' ? 'Montant mensuel' : 'Montant du don'}
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className={amount === p ? 'btn-primary flex-1 py-2' : 'btn-outline flex-1 py-2'}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input flex-1"
            aria-label="Montant personnalise"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input w-28"
            aria-label="Devise"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
      </div>

      {mode === 'SPONSORSHIP' && (
        <>
          <div>
            <label htmlFor="scope" className="label">
              Objet du parrainage
            </label>
            <select id="scope" value={scope} onChange={(e) => setScope(e.target.value)} className="input">
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule" className="label">
              Duree
            </label>
            <select id="rule" value={endRule} onChange={(e) => setEndRule(e.target.value)} className="input">
              {RULES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label htmlFor="prov" className="label">
          Moyen de paiement
        </label>
        <select id="prov" value={provider} onChange={(e) => setProvider(e.target.value)} className="input">
          {methods?.map((m) => (
            <option key={m.provider} value={m.provider}>
              {m.provider}
              {m.configured ? '' : ' (bac a sable)'}
            </option>
          ))}
        </select>
      </div>

      <FeeBreakdown amount={amount} currency={currency} />

      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}

      <button onClick={submit} disabled={busy || amount < 1} className="btn-primary w-full py-3">
        {busy ? <Spinner className="h-4 w-4" /> : null}
        {mode === 'SPONSORSHIP'
          ? `Parrainer ${childName ?? ''}`.trim()
          : `Donner ${money(amount, currency)}`}
      </button>
    </div>
  );
}
