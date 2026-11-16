'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Loading';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { t } from '@/lib/i18n';

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
  // Ce que le lien contient : un Super Admin invité choisit aussi sa clé administrateur.
  const [needsKey, setNeedsKey] = useState(false);
  const [adminRank, setAdminRank] = useState<number | null>(null);
  const [adminKey, setAdminKey] = useState('');
  const [adminKeyConfirm, setAdminKeyConfirm] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .get<{ needsAdminKey: boolean; adminRank: number | null }>(`/auth/activate/info?token=${encodeURIComponent(token)}`)
      .then((i) => {
        setNeedsKey(!!i.needsAdminKey);
        setAdminRank(i.adminRank ?? null);
      })
      .catch(() => undefined); // un lien invalide est signalé à l'envoi du formulaire
  }, [token]);

  async function resendCode() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const r = await api.post<any>('/auth/activate/resend-otp', { token });
      setInfo(
        r.emailSent === false && !r.devOtp
          ? t("L’e-mail n’a pas pu être envoyé. Contactez votre responsable.")
          : t("Un nouveau code vient de vous être envoyé par e-mail."),
      );
    } catch (err: any) {
      setError(err?.message ?? t("Envoi impossible"));
    }
    setResending(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(otp)) {
      setError(t("Saisissez le code à 6 chiffres reçu par e-mail"));
      return;
    }
    if (password !== confirm) {
      setError(t("Les deux mots de passe ne correspondent pas"));
      return;
    }
    if (needsKey) {
      if (password.length < 12) {
        setError(t("Le mot de passe d’un Super Admin doit contenir au moins 12 caractères"));
        return;
      }
      if (adminKey.trim().length < 16) {
        setError(t("La clé administrateur doit contenir au moins 16 caractères"));
        return;
      }
      if (adminKey !== adminKeyConfirm) {
        setError(t("Les deux clés administrateur ne correspondent pas"));
        return;
      }
    }
    setBusy(true);
    try {
      const res = await api.post<any>('/auth/activate', { token, otp, password, ...(needsKey ? { adminKey: adminKey.trim() } : {}) });
      setTokens(res.accessToken, res.refreshToken);
      await refresh();
      router.push(res.twoFactorRequired ? '/profil?2fa=1' : '/tableau-de-bord');
    } catch (err: any) {
      setError(err?.message ?? t("Activation impossible"));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t("Lien d'activation incomplet. Utilisez le lien exact reçu par e-mail, ou demandez un nouvel envoi à votre responsable.")}
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
          {t("Code reçu par e-mail")}
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
          {t("Code à 6 chiffres, valable 15 minutes.")}{' '}
          <button
            type="button"
            onClick={resendCode}
            disabled={resending}
            className="font-medium text-risac-600 hover:text-risac-700 disabled:opacity-50"
          >
            {resending ? t("Envoi…") : t("Renvoyer le code")}
          </button>
        </p>
      </div>

      <div>
        <label htmlFor="password" className="label">
          {t("Choisir un mot de passe")}
        </label>
        <PasswordInput
          id="password"
          required
          minLength={needsKey ? 12 : 8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="label">
          {t("Confirmer le mot de passe")}
        </label>
        <PasswordInput
          id="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
        />
      </div>

      {needsKey && (
        <div className="space-y-4 rounded-xl border border-sun-200 bg-sun-50 p-4">
          <p className="text-sm text-ink-800">
            <strong>{t("Super Admin")}{adminRank ? ` n°${adminRank}` : ''}.</strong>{' '}{t("Choisissez votre clé administrateur : elle vous sera demandée à chaque connexion, en plus du mot de passe. Conservez-la précieusement : si vous la perdez, seul le Super Admin n°1 peut réinitialiser vos identifiants.")}
          </p>
          <div>
            <label htmlFor="admin-key" className="label">
              {t("Clé administrateur (16 caractères au moins)")}
            </label>
            <PasswordInput
              id="admin-key"
              name="adminKey"
              required
              minLength={16}
              autoComplete="off"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="input font-mono"
            />
          </div>
          <div>
            <label htmlFor="admin-key-confirm" className="label">
              {t("Confirmer la clé administrateur")}
            </label>
            <PasswordInput
              id="admin-key-confirm"
              required
              autoComplete="off"
              value={adminKeyConfirm}
              onChange={(e) => setAdminKeyConfirm(e.target.value)}
              className="input font-mono"
            />
          </div>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full py-3">
        {busy ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {t("Activer mon compte")}
      </button>
    </form>
  );
}

export default function ActivatePage() {
  return (
    <div>
      <h1 className="text-balance text-center text-xl font-semibold tracking-tight text-ink-950 sm:text-2xl">{t("Activer votre compte")}</h1>
      <p className="mt-1 text-pretty text-center text-sm text-ink-500">
        {t("Saisissez le code reçu par e-mail et définissez votre mot de passe pour rejoindre le réseau RISAC.")}
      </p>
      <div className="mt-6">
        <Suspense fallback={<Spinner />}>
          <ActivateForm />
        </Suspense>
      </div>
    </div>
  );
}
