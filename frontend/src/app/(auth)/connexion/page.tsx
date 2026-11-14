'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Loading';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(email, password, needsTotp ? totp : undefined);
      if (res.adminKeyRequired) {
        setError('Ce compte est un compte Super Admin : connectez-vous depuis l’espace administrateur (/admin), avec votre clé.');
        setBusy(false);
        return;
      }
      if (res.twoFactorRequired) {
        setNeedsTotp(true);
        setBusy(false);
        return;
      }
      router.push('/tableau-de-bord');
    } catch (err: any) {
      setError(err?.message ?? 'Connexion impossible');
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="text-center">
        <h1 className="text-balance text-xl font-semibold tracking-tight text-ink-950 sm:text-2xl">Se connecter</h1>
        <p className="mt-1 text-pretty text-sm text-ink-500">
          Acc&eacute;dez &agrave; votre espace selon votre r&ocirc;le dans le r&eacute;seau.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="email" className="label">
            Adresse e-mail
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
              placeholder="vous@exemple.org"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="label">
            Mot de passe
          </label>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {needsTotp && (
          <div className="animate-fade-up">
            <label htmlFor="totp" className="label">
              Code de double authentification
            </label>
            <input
              id="totp"
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
              className="input text-center text-lg tabular-nums tracking-[0.4em]"
              placeholder="000000"
            />
            <p className="mt-2 text-xs text-ink-500">
              Saisissez le code &agrave; six chiffres de votre application d&apos;authentification.
            </p>
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? <Spinner className="h-4 w-4" /> : null}
          {busy ? 'Connexion…' : needsTotp ? 'Valider le code' : 'Se connecter'}
        </button>
      </form>

      <div className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-center text-sm leading-6 text-ink-600">
        <p>
          Soutenir un enfant&nbsp;?{' '}
          <Link href="/inscription" className="link-inline">
            Cr&eacute;er un compte bailleur
          </Link>
        </p>
        <p>
          Administrateur&nbsp;?{' '}
          <Link href="/admin" className="link-inline">
            Espace administrateur
          </Link>
        </p>
        <p className="text-xs text-ink-500">Les autres r&ocirc;les re&ccedil;oivent une invitation par e-mail.</p>
      </div>
    </div>
  );
}
