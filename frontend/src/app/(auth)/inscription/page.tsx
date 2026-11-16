'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { CountrySelect } from '@/components/geo/GeoSelects';
import { AlertCircle } from 'lucide-react';
import { api, fetcher, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Loading';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { t } from '@/lib/i18n';

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
            ? t("Votre compte est créé, mais l’e-mail n’a pas pu être envoyé. Utilisez « Renvoyer le code ».")
            : t("Un code à 6 chiffres vient d’être envoyé à {email}.", { email: form.email }),
        );
        setBusy(false);
        return;
      }
      setTokens(res.accessToken, res.refreshToken);
      await refresh();
      router.push('/tableau-de-bord');
    } catch (err: any) {
      setError(err?.message ?? t("Inscription impossible"));
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
      setError(err?.message ?? t("Vérification impossible"));
      setBusy(false);
    }
  }

  async function resendCode() {
    setError(null);
    setInfo(null);
    try {
      await api.post('/auth/verify-email/resend', { email: form.email });
      setInfo(t("Si l’adresse est en attente de confirmation, un nouveau code vient d’être envoyé."));
    } catch (err: any) {
      setError(err?.message ?? t("Envoi impossible"));
    }
  }

  if (step === 'verify') {
    return (
      <div>
        <h1 className="text-balance text-center text-xl font-semibold tracking-tight text-ink-950 sm:text-2xl">{t("Confirmez votre adresse")}</h1>
        <p className="mt-1 text-pretty text-center text-sm text-ink-500">
          {t("Saisissez le code à 6 chiffres envoyé à")}{' '}<strong>{form.email}</strong>{' '}{t("pour activer votre compte.")}
        </p>

        <form onSubmit={onVerify} className="mt-6 space-y-4" noValidate>
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
              {t("Code de vérification")}
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
              {t("Valable 15 minutes.")}{' '}
              <button type="button" onClick={resendCode} className="font-medium text-risac-600 hover:text-risac-700">
                {t("Renvoyer le code")}
              </button>
            </p>
          </div>

          <button type="submit" disabled={busy || otp.length !== 6} className="btn-primary w-full py-3">
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {t("Activer mon compte")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-balance text-center text-xl font-semibold tracking-tight text-ink-950 sm:text-2xl">{t("Devenir bailleur")}</h1>
      <p className="mt-1 text-pretty text-center text-sm text-ink-500">
        {t("Soutenez un enfant ou un projet, et suivez chaque dépense jusqu'à sa preuve.")}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
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
              {t("Prénom")}
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
              {t("Nom")}
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
            {t("Adresse e-mail")}
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
            {t("Mot de passe")}
          </label>
          <PasswordInput
            id="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            className="input"
          />
          <p className="mt-1.5 text-xs text-ink-400">{t("Au moins 8 caractères.")}</p>
        </div>

        <div>
          <label htmlFor="countryId" className="label">
            {t("Pays de résidence")}
          </label>
          <CountrySelect id="countryId" value={form.countryId} onChange={(id) => set('countryId', id)} />
          <p className="mt-1.5 text-xs text-ink-400">
            {t("Détermine les moyens de paiement qui vous sont proposés.")}
          </p>
        </div>

        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? <Spinner className="h-4 w-4" /> : null}
          {t("Créer mon compte")}
        </button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        {t("Vous avez déjà un compte ?")}{' '}
        <Link href="/connexion" className="inline-flex min-h-[44px] items-center font-medium text-risac-700 hover:text-risac-800 sm:min-h-0">
          {t("Se connecter")}
        </Link>
      </p>
    </div>
  );
}
