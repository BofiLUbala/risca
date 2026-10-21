'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AlertCircle } from 'lucide-react';
import { api, fetcher, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Loading';

interface Country {
  id: string;
  iso2: string;
  nameFr: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { data: countries } = useSWR<Country[]>('/geo/countries', fetcher);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    countryId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otp, setOtp] = useState('');

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<any>('/auth/register-donor', {
        ...form,
        countryId: form.countryId || undefined,
      });
      if (res.pendingVerification) {
        setStep('verify');
        setInfo(
          res.emailSent === false && !res.devOtp
            ? 'Votre compte est créé, mais l’e-mail n’a pas pu être envoyé. Utilisez « Renvoyer le code ».'
            : `Un code à 6 chiffres vient d’être envoyé à ${form.email}.`,
        );
        setBusy(false);
        return;
      }
      setTokens(res.accessToken, res.refreshToken);
      await refresh();
      router.push('/tableau-de-bord');
    } catch (err: any) {
      setError(err?.message ?? 'Inscription impossible');
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await api.post<any>('/auth/verify-email', { email: form.email, otp });
      setTokens(res.accessToken, res.refreshToken);
      await refresh();
      router.push('/tableau-de-bord');
    } catch (err: any) {
      setError(err?.message ?? 'Vérification impossible');
      setBusy(false);
    }
  }

  async function resendCode() {
    setError(null);
    setInfo(null);
    try {
      await api.post('/auth/verify-email/resend', { email: form.email });
      setInfo('Si l’adresse est en attente de confirmation, un nouveau code vient d’être envoyé.');
    } catch (err: any) {
      setError(err?.message ?? 'Envoi impossible');
    }
  }

  if (step === 'verify') {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Confirmez votre adresse</h1>
        <p className="mt-2 text-sm text-ink-500">
          Saisissez le code &agrave; 6 chiffres envoy&eacute; &agrave; <strong>{form.email}</strong> pour activer
          votre compte.
        </p>

        <form onSubmit={onVerify} className="mt-8 space-y-5" noValidate>
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
              {info}
            </div>
          )}

          <div>
            <label htmlFor="otp" className="label">
              Code de v&eacute;rification
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input text-center text-lg tracking-[0.5em]"
            />
            <p className="mt-1.5 text-xs text-ink-400">
              Valable 15 minutes.{' '}
              <button type="button" onClick={resendCode} className="font-medium text-risac-600 hover:text-risac-700">
                Renvoyer le code
              </button>
            </p>
          </div>

          <button type="submit" disabled={busy || otp.length !== 6} className="btn-primary w-full py-3">
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Activer mon compte
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Devenir bailleur</h1>
      <p className="mt-2 text-sm text-ink-500">
        Soutenez un enfant ou un projet, et suivez chaque d&eacute;pense jusqu&apos;&agrave; sa
        preuve.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="label">
              Pr&eacute;nom
            </label>
            <input
              id="firstName"
              required
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="label">
              Nom
            </label>
            <input
              id="lastName"
              required
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            className="input"
          />
          <p className="mt-1.5 text-xs text-ink-400">Au moins 8 caract&egrave;res.</p>
        </div>

        <div>
          <label htmlFor="countryId" className="label">
            Pays de r&eacute;sidence
          </label>
          <select
            id="countryId"
            value={form.countryId}
            onChange={(e) => set('countryId', e.target.value)}
            className="input"
          >
            <option value="">Choisir un pays</option>
            {countries?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFr}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-400">
            D&eacute;termine les moyens de paiement qui vous sont propos&eacute;s.
          </p>
        </div>

        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? <Spinner className="h-4 w-4" /> : null}
          Cr&eacute;er mon compte
        </button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        Vous avez d&eacute;j&agrave; un compte ?{' '}
        <Link href="/connexion" className="inline-flex min-h-[44px] items-center font-medium text-risac-700 hover:text-risac-800 sm:min-h-0">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
