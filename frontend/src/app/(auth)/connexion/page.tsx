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
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Se connecter</h1>
      <p className="mt-2 text-sm text-ink-500">
        Acc&eacute;dez &agrave; votre espace selon votre r&ocirc;le dans le r&eacute;seau.
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

        <div>
          <label htmlFor="email" className="label">
            Adresse e-mail
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
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
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-10"
              placeholder="........"
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
              inputMode="numeric"
              maxLength={6}
              required
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
              className="input text-center text-lg tracking-[0.4em]"
              placeholder="000000"
            />
            <p className="mt-2 text-xs text-ink-400">
              Saisissez le code &agrave; six chiffres de votre application d&apos;authentification.
            </p>
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? <Spinner className="h-4 w-4" /> : null}
          {needsTotp ? 'Valider le code' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        Vous souhaitez soutenir un enfant ?{' '}
        <Link href="/inscription" className="font-medium text-risac-600 hover:text-risac-700">
          Cr&eacute;er un compte bailleur
        </Link>
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Les autres r&ocirc;les re&ccedil;oivent une invitation par e-mail.
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Administrateur de la plateforme ?{' '}
        <Link href="/admin" className="font-medium text-risac-700 hover:text-risac-800">
          Espace administrateur
        </Link>
      </p>
    </div>
  );
}
