'use client';
import { promptDialog, confirmDialog } from '@/lib/dialog';

import { useState } from 'react';
import { BellOff, BellRing, KeyRound, LockOpen, LogOut, ShieldAlert, Snowflake, UserX } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Target = { id: string; firstName: string; lastName: string; pushExempt?: boolean; status?: string; role?: string; adminRank?: number | null };

/**
 * Actions de discipline sur un compte : avertissement (Super Admin, Modérateur)
 * et déconnexion forcée (Super Admin). L'avertissement arrive en notification
 * chez la personne visée, la déconnexion révoque ses jetons immédiatement.
 */
export function UserActions({ target, onDone }: { target: Target; onDone: () => void }) {
  const { user } = useAuth();
  const canWarn = ['SUPER_ADMIN', 'MODERATOR'].includes(user?.role ?? '');
  const canForceLogout = user?.role === 'SUPER_ADMIN';
  const self = user?.id === target.id;
  // Hiérarchie des Super Admin : le n°1 n'est modifiable par personne, et seul le n°1 agit sur le n°2 et le n°3.
  const isPrimary = user?.role === 'SUPER_ADMIN' && user?.adminRank === 1;
  const targetIsAdmin = target.role === 'SUPER_ADMIN';
  const hiddenByHierarchy = targetIsAdmin && (target.adminRank === 1 || !isPrimary);
  const canRecover = isPrimary && targetIsAdmin && target.adminRank !== 1;

  const [mode, setMode] = useState<'warn' | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'warn' | 'logout' | 'exempt' | 'freeze' | 'forget' | 'reset' | 'unlock' | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const name = `${target.firstName} ${target.lastName}`;
  if (self || hiddenByHierarchy || (!canWarn && !canForceLogout)) return null;

  /** Le n°1 réinitialise les identifiants d'un Super Admin qui les a perdus : nouveau lien d'activation + code. */
  async function resetCredentials() {
    if (
      !await confirmDialog(
        `Réinitialiser les identifiants de ${name} ? Son mot de passe, sa clé et sa double authentification seront effacés ; il recevra un lien d’activation et un code pour en choisir de nouveaux.`,
      )
    )
      return;
    setBusy('reset');
    setNotice(null);
    try {
      const r = await api.post<{ activationUrl: string; devOtp?: string; emailSent?: boolean }>(`/auth/admin/${target.id}/reset-credentials`, {});
      setNotice({
        ok: r.emailSent !== false,
        text:
          r.emailSent !== false
            ? `Identifiants de ${name} réinitialisés : un lien d’activation et un code lui ont été envoyés par e-mail.`
            : `Identifiants réinitialisés, mais l’e-mail n’a pas pu partir. Transmettez-lui ce lien : ${r.activationUrl}`,
      });
      onDone();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'La réinitialisation a échoué.' });
    }
    setBusy(null);
  }

  /** Le n°1 débloque un Super Admin verrouillé ou suspendu. */
  async function unlockAdmin() {
    if (!await confirmDialog(`Débloquer ${name} ?`)) return;
    setBusy('unlock');
    setNotice(null);
    try {
      await api.post(`/auth/admin/${target.id}/unlock`, {});
      setNotice({ ok: true, text: `${name} est débloqué.` });
      onDone();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'Le déblocage a échoué.' });
    }
    setBusy(null);
  }

  async function sendWarning() {
    const body = message.trim();
    if (!body) return;
    setBusy('warn');
    setNotice(null);
    try {
      await api.post(`/users/${target.id}/warn`, { message: body });
      setNotice({ ok: true, text: `Avertissement envoyé à ${name}.` });
      setMessage('');
      setMode(null);
      onDone();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? "L’avertissement n’a pas pu être envoyé." });
    }
    setBusy(null);
  }

  /**
   * Dispense d'activer les notifications. Porte de sortie pour quelqu'un dont le
   * navigateur refuse definitivement l'autorisation, ou dont le reseau bloque les
   * serveurs de notification : sans elle, la personne perdrait l'acces a RISAC.
   */
  async function togglePushExempt() {
    const next = !target.pushExempt;
    if (
      !await confirmDialog(
        next
          ? `Dispenser ${name} des notifications ? Cette personne pourra accéder à RISAC sans les activer.`
          : `Retirer la dispense de ${name} ? L’activation des notifications redeviendra obligatoire.`,
      )
    )
      return;
    setBusy('exempt');
    setNotice(null);
    try {
      await api.patch(`/users/${target.id}/push-exempt`, { exempt: next });
      setNotice({
        ok: true,
        text: next ? `${name} est dispensé des notifications.` : `La dispense de ${name} est retirée.`,
      });
      onDone();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'La dispense n’a pas pu être modifiée.' });
    }
    setBusy(null);
  }

  /** Gel du compte par la gouvernance : acces coupe sur-le-champ, motif obligatoire et journalise. */
  async function freezeAccount() {
    const reason = await promptDialog(`Motif du gel du compte de ${name} ?`);
    if (!reason?.trim()) return;
    setBusy('freeze');
    setNotice(null);
    try {
      await api.post(`/users/${target.id}/freeze`, { reason: reason.trim() });
      setNotice({ ok: true, text: `Le compte de ${name} est gelé.` });
      onDone();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'Le gel a échoué.' });
    }
    setBusy(null);
  }

  /**
   * Droit a l'effacement : l'identite est remplacee par une valeur neutre et le compte bloque.
   * Irreversible, d'ou la saisie d'un mot de confirmation plutot qu'un simple « OK ».
   */
  async function anonymiseAccount() {
    const answer = await promptDialog(
      `Anonymiser ${name} efface son identité et ses coordonnées de façon définitive.\nTapez ANONYMISER pour confirmer.`,
    );
    if (answer?.trim() !== 'ANONYMISER') return;
    setBusy('forget');
    setNotice(null);
    try {
      await api.del(`/users/${target.id}/personal-data`);
      setNotice({ ok: true, text: 'Le compte est anonymisé.' });
      onDone();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'L’anonymisation a échoué.' });
    }
    setBusy(null);
  }

  async function forceLogout() {
    if (!await confirmDialog(`Déconnecter ${name} de toutes ses sessions ?`)) return;
    setBusy('logout');
    setNotice(null);
    try {
      await api.post(`/auth/users/${target.id}/force-logout`, {});
      setNotice({ ok: true, text: `${name} a été déconnecté de toutes ses sessions.` });
      onDone();
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message ?? 'La déconnexion a échoué.' });
    }
    setBusy(null);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        {canWarn && (
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'warn' ? null : 'warn'))}
            className="btn-outline px-3 text-xs"
            aria-expanded={mode === 'warn'}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Avertir
          </button>
        )}
        {canRecover && (
          <>
            <button
              type="button"
              onClick={resetCredentials}
              disabled={busy === 'reset'}
              aria-busy={busy === 'reset'}
              className="btn-outline px-3 text-xs"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {busy === 'reset' ? 'Réinitialisation…' : 'Réinitialiser ses identifiants'}
            </button>
            <button
              type="button"
              onClick={unlockAdmin}
              disabled={busy === 'unlock'}
              aria-busy={busy === 'unlock'}
              className="btn-outline px-3 text-xs"
            >
              <LockOpen className="h-3.5 w-3.5" />
              {busy === 'unlock' ? 'Déblocage…' : 'Débloquer'}
            </button>
          </>
        )}
        {canForceLogout && (
          <button
            type="button"
            onClick={togglePushExempt}
            disabled={busy === 'exempt'}
            aria-busy={busy === 'exempt'}
            aria-pressed={!!target.pushExempt}
            className="btn-outline px-3 text-xs"
          >
            {target.pushExempt ? <BellRing className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            {target.pushExempt ? 'Rendre obligatoire' : 'Dispenser du push'}
          </button>
        )}
        {canForceLogout && (
          <button
            type="button"
            onClick={forceLogout}
            disabled={busy === 'logout'}
            aria-busy={busy === 'logout'}
            className="btn-outline px-3 text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            {busy === 'logout' ? 'Déconnexion…' : 'Déconnecter'}
          </button>
        )}
        {canForceLogout && target.status !== 'FROZEN' && (
          <button
            type="button"
            onClick={freezeAccount}
            disabled={busy === 'freeze'}
            aria-busy={busy === 'freeze'}
            className="btn-outline px-3 text-xs"
          >
            <Snowflake className="h-3.5 w-3.5" />
            {busy === 'freeze' ? 'Gel…' : 'Geler'}
          </button>
        )}
        {canForceLogout && (
          <button
            type="button"
            onClick={anonymiseAccount}
            disabled={busy === 'forget'}
            aria-busy={busy === 'forget'}
            className="btn-outline px-3 text-xs text-rose-700"
          >
            <UserX className="h-3.5 w-3.5" />
            {busy === 'forget' ? 'Anonymisation…' : 'Anonymiser'}
          </button>
        )}
      </div>

      {mode === 'warn' && (
        <div className="w-full rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:w-80">
          <label htmlFor={`warn-${target.id}`} className="label">
            Motif de l&apos;avertissement
          </label>
          <textarea
            id={`warn-${target.id}`}
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input"
            placeholder={`Message adressé à ${name}`}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={sendWarning}
              disabled={!message.trim() || busy === 'warn'}
              aria-busy={busy === 'warn'}
              className="btn-primary px-3 text-xs"
            >
              {busy === 'warn' ? 'Envoi…' : 'Envoyer'}
            </button>
            <button type="button" onClick={() => setMode(null)} className="btn-ghost px-3 text-xs">
              Annuler
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className={`text-xs ${notice.ok ? 'text-emerald-700' : 'text-rose-700'}`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
