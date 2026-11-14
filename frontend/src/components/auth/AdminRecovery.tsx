'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Loading';
import { PasswordInput } from '@/components/ui/PasswordInput';

/**
 * Identifiants perdus d'un Super Admin.
 * - n°2 ou n°3 : aucune démarche ici, ils écrivent au Super Admin n°1 qui réinitialise leurs identifiants.
 * - n°1 : personne au-dessus de lui, il se récupère avec la clé d'installation du serveur et un code reçu par e-mail.
 */
export function AdminRecovery() {
  const [step, setStep] = useState<'start' | 'confirm' | 'done'>('start');
  const [email, setEmail] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/auth/admin/recover/start', { email: email.trim(), setupKey: setupKey.trim() });
      setStep('confirm');
    } catch (err: any) {
      setError(err?.message ?? 'Demande impossible');
    }
    setBusy(false);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) return setError('Le mot de passe doit contenir au moins 12 caractères');
    if (adminKey.trim().length < 16) return setError('La clé administrateur doit contenir au moins 16 caractères');
    setBusy(true);
    try {
      await api.post('/auth/admin/recover/confirm', {
        email: email.trim(),
        setupKey: setupKey.trim(),
        otp,
        password,
        adminKey: adminKey.trim(),
      });
      setStep('done');
    } catch (err: any) {
      setError(err?.message ?? 'Récupération impossible');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4 text-sm text-ink-700">
      <div className="rounded-xl bg-ink-50 p-3.5">
        <p className="font-semibold text-ink-900">Super Admin n°2 ou n°3</p>
        <p className="mt-1">
          Écrivez directement au <strong>Super Admin n°1</strong> : il réinitialise vos identifiants depuis la page
          Utilisateurs et vous renvoie un lien d’activation. Vous choisissez alors un nouveau mot de passe et une nouvelle clé.
        </p>
      </div>

      <div className="rounded-xl bg-ink-50 p-3.5">
        <p className="font-semibold text-ink-900">Super Admin n°1</p>
        <p className="mt-1">
          Aucun compte n’est au-dessus du vôtre : récupérez votre accès avec la <strong>clé d’installation du serveur</strong> et un
          code reçu par e-mail.
        </p>

        {error && (
          <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-3 text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {step === 'start' && (
          <form onSubmit={start} className="mt-3 space-y-3" noValidate>
            <div>
              <label htmlFor="r-email" className="label">
                Adresse e-mail du Super Admin n°1
              </label>
              <input
                id="r-email"
                type="email"
                required
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="r-setup" className="label">
                Clé d’installation du serveur
              </label>
              <PasswordInput
                id="r-setup"
                required
                autoComplete="off"
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
                className="input font-mono"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-outline w-full">
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Recevoir un code par e-mail
            </button>
          </form>
        )}

        {step === 'confirm' && (
          <form onSubmit={confirm} className="mt-3 space-y-3" noValidate>
            <p className="text-ink-600">Un code à 6 chiffres vient d’être envoyé à {email}. Choisissez vos nouveaux identifiants.</p>
            <div>
              <label htmlFor="r-otp" className="label">
                Code reçu par e-mail
              </label>
              <input
                id="r-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input text-center text-lg tabular-nums tracking-[0.4em]"
                placeholder="000000"
              />
            </div>
            <div>
              <label htmlFor="r-pass" className="label">
                Nouveau mot de passe (12 caractères au moins)
              </label>
              <PasswordInput id="r-pass" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </div>
            <div>
              <label htmlFor="r-key" className="label">
                Nouvelle clé administrateur (16 caractères au moins)
              </label>
              <PasswordInput id="r-key" required autoComplete="off" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} className="input font-mono" />
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Récupérer mon accès
            </button>
          </form>
        )}

        {step === 'done' && (
          <div role="status" className="mt-3 flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Accès rétabli. Connectez-vous avec votre nouveau mot de passe et votre nouvelle clé administrateur.</span>
          </div>
        )}
      </div>
    </div>
  );
}
