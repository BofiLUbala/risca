'use client';

import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

export function SecuritySection({
  twoFactorEnabled,
  role,
  onChanged,
}: {
  twoFactorEnabled: boolean;
  /** Rôle de la personne connectée : certains rôles ne peuvent pas désactiver. */
  role?: string;
  onChanged: () => Promise<void> | void;
}) {
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [twoFa, setTwoFa] = useState<{ secret: string; otpauth: string } | null>(null);
  const [totp, setTotp] = useState('');
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  // La double authentification est obligatoire pour ces rôles : l’API refuse de la
  // désactiver, le bouton n’est donc pas proposé.
  const mandatory = ['SUPER_ADMIN', 'ADMIN_FINANCE', 'MODERATOR', 'ETHICS_AUDITOR'].includes(role ?? '');

  async function disable2fa() {
    if (!window.confirm('Désactiver la double authentification sur votre compte ?')) return;
    setDisabling(true);
    setTwoFaMsg(null);
    try {
      await api.post('/auth/2fa/disable', {});
      setTwoFaMsg('Double authentification désactivée.');
      onChanged();
    } catch (e: any) {
      setTwoFaMsg(e?.message ?? 'La désactivation a échoué.');
    }
    setDisabling(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    try {
      await api.post('/auth/password', { currentPassword: pwd.current, newPassword: pwd.next });
      setPwdMsg('Mot de passe modifie.');
      setPwd({ current: '', next: '' });
    } catch (err: any) {
      setPwdMsg(err?.message ?? 'Modification impossible');
    }
  }

  async function start2fa() {
    setTwoFa(await api.post<any>('/auth/2fa/start', {}));
  }

  async function enable2fa(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaMsg(null);
    try {
      await api.post('/auth/2fa/enable', { totp });
      setTwoFaMsg('Double authentification activée.');
      setTwoFa(null);
      setTotp('');
      await onChanged();
    } catch (err: any) {
      setTwoFaMsg(err?.message ?? 'Code invalide');
    }
  }

  return (
    <>
      <section className="card card-pad">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <KeyRound className="h-4 w-4" />
          Mot de passe
        </h2>
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cp" className="label">
              Mot de passe actuel
            </label>
            <input
              id="cp"
              type="password"
              required
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="np" className="label">
              Nouveau mot de passe
            </label>
            <input
              id="np"
              type="password"
              required
              minLength={8}
              value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-outline">
              Modifier le mot de passe
            </button>
            {pwdMsg && <p className="mt-2 text-sm text-ink-600">{pwdMsg}</p>}
          </div>
        </form>
      </section>

      <section className="card card-pad">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
          <ShieldCheck className="h-4 w-4" />
          Double authentification
        </h2>
        <p className="mb-4 text-sm text-ink-500">
          {twoFactorEnabled
            ? 'Activée sur votre compte.'
            : 'Obligatoire pour les rôles administrateurs.'}
        </p>

        {!twoFactorEnabled && !twoFa && (
          <button onClick={start2fa} className="btn-primary">
            Activer la double authentification
          </button>
        )}

        {twoFactorEnabled &&
          (mandatory ? (
            <p className="text-sm text-ink-500">
              Obligatoire pour votre rôle : elle ne peut pas être désactivée.
            </p>
          ) : (
            <button
              onClick={disable2fa}
              disabled={disabling}
              aria-busy={disabling}
              className="btn-outline"
            >
              {disabling ? 'Désactivation…' : 'Désactiver la double authentification'}
            </button>
          ))}

        {twoFa && (
          <form onSubmit={enable2fa} className="space-y-3">
            <p className="text-sm text-ink-600">
              Ajoutez ce secret dans votre application d’authentification :
            </p>
            <code className="block break-all rounded-xl bg-ink-50 px-4 py-3 text-sm">
              {twoFa.secret}
            </code>
            <input
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              inputMode="numeric"
              placeholder="000000"
              className="input max-w-[200px] text-center tracking-[0.4em]"
              aria-label="Code a six chiffres"
            />
            <button type="submit" className="btn-primary">
              Valider le code
            </button>
          </form>
        )}

        {twoFaMsg && <p className="mt-3 text-sm text-ink-600">{twoFaMsg}</p>}
      </section>
    </>
  );
}
