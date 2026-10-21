'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api, fetcher, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/Loading';

// Rôles autorisés à entrer par cette porte : les comptes d'administration.
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_FINANCE', 'MODERATOR', 'ETHICS_AUDITOR'];

type Tab = 'login' | 'create';

function Alert({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'ok' }) {
  const ok = tone === 'ok';
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm ${
        ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { login, logout, refresh } = useAuth();
  const { data: setup } = useSWR<{
    adminExists: boolean;
    creationOpen: boolean;
    claimable: boolean;
    installKeyRequired: boolean;
  }>('/auth/admin/setup-status', fetcher);

  const [tab, setTab] = useState<Tab>('login');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Connexion
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [loginKey, setLoginKey] = useState('');
  const [needsKey, setNeedsKey] = useState(false);

  // Création du compte
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Clé administrateur aléatoire de 32 caractères hexadécimaux, tirée dans le navigateur.
  function generateKey() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    setAdminKey(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));
    setShowKey(true);
    setKeySaved(false);
    setCopied(false);
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(adminKey);
      setCopied(true);
    } catch {
      setError('Copie impossible : sélectionnez la clé et copiez-la à la main.');
    }
  }
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [otp, setOtp] = useState('');

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
    setInfo(null);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(email, password, needsTotp ? totp : undefined, loginKey || undefined);
      if (res.adminKeyRequired) {
        setNeedsKey(true);
        setInfo('Saisissez la clé administrateur que vous avez choisie à la création de votre compte.');
        setBusy(false);
        return;
      }
      if (res.twoFactorRequired) {
        setNeedsTotp(true);
        setBusy(false);
        return;
      }
      const me = await api.get<{ role: string }>('/auth/me');
      if (!ADMIN_ROLES.includes(me.role)) {
        await logout();
        setError('Cet espace est réservé aux comptes d’administration. Utilisez la page de connexion générale.');
        setBusy(false);
        return;
      }
      router.push('/tableau-de-bord');
    } catch (err: any) {
      setError(err?.message ?? 'Connexion impossible');
      setBusy(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError('Le mot de passe doit contenir au moins 12 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (adminKey.trim().length < 16) {
      setError('La clé administrateur doit contenir au moins 16 caractères.');
      return;
    }
    if (!keySaved) {
      setError('Confirmez que vous avez conservé votre clé : elle ne pourra pas être affichée de nouveau.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<any>('/auth/admin/register', {
        firstName,
        lastName,
        email,
        password,
        adminKey: adminKey.trim(),
        setupKey: setupKey || undefined,
      });
      setStep('verify');
      setInfo(
        res.emailSent === false && !res.devOtp
          ? 'Le compte est créé, mais l’e-mail n’a pas pu être envoyé. Utilisez « Renvoyer le code ».'
          : `Un code à 6 chiffres vient d’être envoyé à ${email}.`,
      );
    } catch (err: any) {
      setError(err?.message ?? 'Création impossible');
    }
    setBusy(false);
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await api.post<any>('/auth/verify-email', { email, otp });
      setTokens(res.accessToken, res.refreshToken);
      await refresh();
      router.push(res.twoFactorRequired ? '/profil?2fa=1' : '/tableau-de-bord');
    } catch (err: any) {
      setError(err?.message ?? 'Vérification impossible');
      setBusy(false);
    }
  }

  async function resendCode() {
    setError(null);
    setInfo(null);
    try {
      await api.post('/auth/verify-email/resend', { email });
      setInfo('Si l’adresse est en attente de confirmation, un nouveau code vient d’être envoyé.');
    } catch (err: any) {
      setError(err?.message ?? 'Envoi impossible');
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-base motion-reduce:transition-none ${
      active ? 'bg-white text-risac-800 shadow-soft' : 'text-ink-500 hover:text-ink-800'
    }`;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-risac-50 text-risac-700">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="page-title">Espace administrateur</h1>
      </div>
      <p className="page-subtitle">Réservé au Super Admin et aux équipes d’administration de RISAC.</p>

      <div role="tablist" aria-label="Accès administrateur" className="mt-6 flex gap-1 rounded-xl bg-ink-100 p-1">
        <button
          type="button"
          role="tab"
          id="tab-login"
          aria-selected={tab === 'login'}
          aria-controls="panel-login"
          onClick={() => switchTab('login')}
          className={tabClass(tab === 'login')}
        >
          Se connecter
        </button>
        <button
          type="button"
          role="tab"
          id="tab-create"
          aria-selected={tab === 'create'}
          aria-controls="panel-create"
          onClick={() => switchTab('create')}
          className={tabClass(tab === 'create')}
        >
          Créer mon compte
        </button>
      </div>

      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        {info && <Alert tone="ok">{info}</Alert>}

        {tab === 'login' && (
          <form id="panel-login" role="tabpanel" aria-labelledby="tab-login" onSubmit={onLogin} className="space-y-5" noValidate>
            <div>
              <label htmlFor="a-email" className="label">
                Adresse e-mail
              </label>
              <input
                id="a-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="a-password" className="label">
                Mot de passe
              </label>
              <input
                id="a-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>
            {needsKey && (
              <div className="animate-fade-up">
                <label htmlFor="a-key" className="label">
                  Clé administrateur
                </label>
                <input
                  id="a-key"
                  type="password"
                  required
                  autoComplete="off"
                  autoFocus
                  value={loginKey}
                  onChange={(e) => setLoginKey(e.target.value)}
                  className="input font-mono"
                />
              </div>
            )}
            {needsTotp && (
              <div className="animate-fade-up">
                <label htmlFor="a-totp" className="label">
                  Code de double authentification
                </label>
                <input
                  id="a-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                  className="input text-center text-lg tracking-[0.4em]"
                  placeholder="000000"
                />
              </div>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? <Spinner className="h-4 w-4" /> : null}
              {needsTotp ? 'Valider le code' : 'Se connecter'}
            </button>
          </form>
        )}

        {tab === 'create' && step === 'form' && setup && !setup.creationOpen && (
          <div id="panel-create" role="tabpanel" aria-labelledby="tab-create" className="space-y-4">
            <Alert>
              Un Super Admin existe déjà : la plateforme n’en admet qu’un seul. Connectez-vous avec son compte et sa
              clé administrateur.
            </Alert>
            <button type="button" onClick={() => switchTab('login')} className="btn-outline w-full py-3">
              Aller à la connexion
            </button>
          </div>
        )}

        {tab === 'create' && step === 'form' && (!setup || setup.creationOpen) && (
          <form id="panel-create" role="tabpanel" aria-labelledby="tab-create" onSubmit={onCreate} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="c-first" className="label">
                  Prénom
                </label>
                <input id="c-first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" />
              </div>
              <div>
                <label htmlFor="c-last" className="label">
                  Nom
                </label>
                <input id="c-last" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label htmlFor="c-email" className="label">
                Adresse e-mail
              </label>
              <input
                id="c-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
              <p className="mt-1.5 text-xs text-ink-500">Un code de confirmation y sera envoyé.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="c-pass" className="label">
                  Mot de passe
                </label>
                <input
                  id="c-pass"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  aria-describedby="c-pass-help"
                />
              </div>
              <div>
                <label htmlFor="c-confirm" className="label">
                  Confirmer
                </label>
                <input
                  id="c-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <p id="c-pass-help" className="-mt-2 text-xs text-ink-500">
              12 caractères au minimum. La double authentification sera exigée dès votre première connexion.
            </p>

            <div>
              <label htmlFor="c-admin-key" className="label">
                Votre clé administrateur
              </label>
              <div className="flex gap-2">
                <input
                  id="c-admin-key"
                  type={showKey ? 'text' : 'password'}
                  required
                  minLength={16}
                  autoComplete="off"
                  spellCheck={false}
                  value={adminKey}
                  onChange={(e) => {
                    setAdminKey(e.target.value);
                    setKeySaved(false);
                  }}
                  className="input flex-1 font-mono"
                  aria-describedby="c-admin-key-help"
                />
                <button type="button" onClick={generateKey} className="btn-outline shrink-0">
                  Générer
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="font-medium text-risac-700 hover:text-risac-800"
                >
                  {showKey ? 'Masquer' : 'Afficher'}
                </button>
                <button
                  type="button"
                  onClick={copyKey}
                  disabled={!adminKey}
                  className="font-medium text-risac-700 hover:text-risac-800 disabled:opacity-40"
                >
                  {copied ? 'Copiée' : 'Copier'}
                </button>
              </div>
              <p id="c-admin-key-help" className="mt-1.5 text-xs text-ink-500">
                16 caractères minimum. Cette clé, que vous seul connaîtrez, sera demandée à chaque connexion en plus du
                mot de passe. Elle est enregistrée chiffrée : personne, pas même nous, ne peut la retrouver.
              </p>
              <label className="mt-3 flex items-start gap-2.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={keySaved}
                  onChange={(e) => setKeySaved(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300"
                />
                <span>J’ai conservé ma clé dans un endroit sûr (gestionnaire de mots de passe).</span>
              </label>
            </div>

            {setup?.installKeyRequired && (
              <div>
                <label htmlFor="c-key" className="label">
                  Clé d’installation
                </label>
                <input
                  id="c-key"
                  type="password"
                  required
                  autoComplete="off"
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  className="input"
                  aria-describedby="c-key-help"
                />
                <p id="c-key-help" className="mt-1.5 text-xs text-ink-500">
                  Clé secrète du serveur (<code className="font-mono">ADMIN_SETUP_KEY</code>). Seul le propriétaire de la
                  plateforme la connaît.
                </p>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Créer mon compte
            </button>
            {setup?.claimable && (
              <p className="text-sm text-ink-500">
                Compte déjà créé mais pas encore confirmé ?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setInfo('Saisissez l’adresse e-mail du compte puis le code reçu (ou demandez-en un nouveau).');
                    setStep('verify');
                  }}
                  className="font-medium text-risac-700 hover:text-risac-800"
                >
                  Saisir mon code
                </button>
              </p>
            )}
          </form>
        )}

        {tab === 'create' && step === 'verify' && (
          <form id="panel-create" role="tabpanel" aria-labelledby="tab-create" onSubmit={onVerify} className="space-y-5" noValidate>
            <div>
              <label htmlFor="v-email" className="label">
                Adresse e-mail du compte
              </label>
              <input
                id="v-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="v-otp" className="label">
                Code de vérification
              </label>
              <input
                id="v-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input text-center text-lg tracking-[0.5em]"
              />
              <p className="mt-1.5 text-xs text-ink-500">
                Valable 15 minutes.{' '}
                <button type="button" onClick={resendCode} className="font-medium text-risac-700 hover:text-risac-800">
                  Renvoyer le code
                </button>
              </p>
            </div>
            <button type="submit" disabled={busy || otp.length !== 6} className="btn-primary w-full py-3">
              {busy ? <Spinner className="h-4 w-4" /> : null}
              Activer mon compte
            </button>
          </form>
        )}
      </div>

      <p className="mt-8 text-sm text-ink-500">
        Vous n’êtes pas administrateur ?{' '}
        <Link href="/connexion" className="inline-flex min-h-[44px] items-center font-medium text-risac-700 hover:text-risac-800 sm:min-h-0">
          Retour à la connexion générale
        </Link>
      </p>
    </div>
  );
}
