'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Loading';

function ActivateForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();
  const token = params.get('token') ?? '';

  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function resendCode() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const r = await api.post<any>('/auth/activate/resend-otp', { token });
      setInfo(
        r.emailSent === false && !r.devOtp
          ? 'L’e-mail n’a pas pu être envoyé. Contactez votre responsable.'
          : 'Un nouveau code vient de vous être envoyé par e-mail.',
      );
    } catch (err: any) {
      setError(err?.message ?? 'Envoi impossible');
    }
    setResending(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('Saisissez le code à 6 chiffres reçu par e-mail');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<any>('/auth/activate', { token, otp, password });
      setTokens(res.accessToken, res.refreshToken);
      await refresh();
      router.push(res.twoFactorRequired ? '/profil?2fa=1' : '/tableau-de-bord');
    } catch (err: any) {
      setError(err?.message ?? 'Activation impossible');
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Lien d&apos;activation incomplet. Utilisez le lien exact re&ccedil;u par e-mail, ou
          demandez un nouvel envoi &agrave; votre responsable.
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      <div>
        <label htmlFor="otp" className="label">
          Code reçu par e-mail
        </label>
        <input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="input text-center text-lg tracking-[0.5em]"
        />
        <p className="mt-1.5 text-xs text-ink-400">
          Code à 6 chiffres, valable 15 minutes.{' '}
          <button
            type="button"
            onClick={resendCode}
            disabled={resending}
            className="font-medium text-risac-600 hover:text-risac-700 disabled:opacity-50"
          >
            {resending ? 'Envoi…' : 'Renvoyer le code'}
          </button>
        </p>
      </div>

      <div>
        <label htmlFor="password" className="label">
          Choisir un mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="label">
          Confirmer le mot de passe
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
        />
      </div>

      <button type="submit" disabled={busy} className="btn-primary w-full py-3">
        {busy ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        Activer mon compte
      </button>
    </form>
  );
}

export default function ActivatePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Activer votre compte</h1>
      <p className="mt-2 text-sm text-ink-500">
        Saisissez le code re&ccedil;u par e-mail et d&eacute;finissez votre mot de passe pour rejoindre le
        r&eacute;seau RISAC.
      </p>
      <div className="mt-8">
        <Suspense fallback={<Spinner />}>
          <ActivateForm />
        </Suspense>
      </div>
    </div>
  );
}
