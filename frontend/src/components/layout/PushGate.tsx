'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, LifeBuoy, RefreshCw, ShieldAlert } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { isPushConfigured, isPushSupported, pushPermission, registerWebPush } from '@/lib/push';

type State = 'granted' | 'refused' | 'blocked' | 'unavailable';

/** Dernier enregistrement réussi de l'appareil : on ne le refait qu'une fois par jour. */
const LAST_REGISTER_KEY = 'risac_push_registered_at';
const REGISTER_EVERY_MS = 24 * 60 * 60 * 1000;
/** Un seul enregistrement en arrière-plan par onglet, quel que soit le nombre de pages ouvertes. */
let registering: Promise<boolean> | null = null;

/** État lu tout de suite, sans attendre le réseau : aucun écran d'attente. */
function readState(exempt?: boolean): State {
  if (exempt || !isPushConfigured()) return 'granted';
  if (!isPushSupported()) return 'unavailable';
  const permission = pushPermission();
  if (permission === 'granted') return 'granted';
  return permission === 'denied' ? 'blocked' : 'refused';
}

function registeredRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(LAST_REGISTER_KEY) || 0);
    return Date.now() - at < REGISTER_EVERY_MS;
  } catch {
    return false;
  }
}

/** Enregistre l'appareil en arrière-plan, sans jamais bloquer l'affichage. */
function registerInBackground(force = false) {
  if (!force && (registering || registeredRecently())) return;
  registering = registerWebPush(false)
    .then((ok) => {
      if (ok) {
        try {
          window.localStorage.setItem(LAST_REGISTER_KEY, String(Date.now()));
        } catch {
          /* stockage indisponible : on réessaiera au prochain chargement */
        }
      }
      return ok;
    })
    .finally(() => {
      registering = null;
    });
}

/**
 * Accès conditionné à l'activation des notifications.
 *
 * - Notifications déjà autorisées : la page s'affiche immédiatement ; l'appareil est
 *   enregistré en arrière-plan, une fois par jour au plus.
 * - Pas encore autorisées, ou refusées : l'espace reste bloqué sur cet écran, à chaque
 *   page et après un rechargement, jusqu'à l'autorisation. Le déblocage est automatique
 *   dès que le navigateur signale le changement.
 *
 * Garde-fous : sans configuration Firebase, rien n'est bloqué ; un compte dispensé par
 * le Super Admin passe toujours.
 */
export function PushGate({ exempt, children }: { exempt?: boolean; children: React.ReactNode }) {
  // PushGate n'est rendu qu'après le chargement du compte, donc côté navigateur :
  // l'état peut être lu dès le premier rendu, sans écran « vérification… ».
  const [state, setState] = useState<State>(() => readState(exempt));
  const [busy, setBusy] = useState(false);

  // Autorisé : enregistrement discret en arrière-plan.
  useEffect(() => {
    if (state === 'granted' && !exempt && isPushConfigured() && isPushSupported()) registerInBackground();
  }, [state, exempt]);

  // Bloqué : on suit l'autorisation du navigateur pour débloquer sans rechargement.
  useEffect(() => {
    if (state === 'granted' || state === 'unavailable') return;
    const recheck = () => setState(readState(exempt));
    let status: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((s) => {
        status = s;
        s.onchange = recheck;
      })
      .catch(() => undefined);
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      if (status) status.onchange = null;
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [state, exempt]);

  const allow = useCallback(async () => {
    setBusy(true);
    // La fenêtre du navigateur n'est demandée qu'au clic, jamais au chargement de la page.
    if (pushPermission() === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        /* navigateur ancien : l'état ci-dessous reste « refusé » */
      }
    }
    const next = readState(exempt);
    setState(next);
    if (next === 'granted') registerInBackground(true);
    setBusy(false);
  }, [exempt]);

  if (state === 'granted') return <>{children}</>;

  const definitive = state === 'blocked' || state === 'unavailable';

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4 py-10">
      <div className="card card-pad w-full max-w-lg animate-fade-up">
        <Logo className="h-10 w-auto" />

        <h1 className="page-title mt-6 flex items-center gap-2.5">
          <BellRing className="h-5 w-5 text-risac-600" aria-hidden />
          Activez les notifications
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          RISAC vous préviendra des validations attendues, des décaissements et des alertes de
          suivi. Ces messages ne peuvent pas attendre que vous pensiez à ouvrir la plateforme :
          leur activation est donc nécessaire pour accéder à votre espace.
        </p>

        {state === 'refused' && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-sm text-amber-900">
              Cliquez ci-dessous, puis choisissez
              <strong className="font-medium"> Autoriser</strong> dans la fenêtre que votre
              navigateur affiche.
            </p>
          </div>
        )}

        {state === 'blocked' && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
            <p className="flex items-start gap-2 text-sm text-rose-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Les notifications sont bloquées pour ce site. Votre navigateur ne reposera plus la
                question tant que vous ne l&apos;aurez pas levé vous-même.
              </span>
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-rose-800">
              <li>Cliquez sur l&apos;icône à gauche de l&apos;adresse du site</li>
              <li>Ouvrez les paramètres du site</li>
              <li>Passez « Notifications » sur « Autoriser »</li>
              <li>Revenez sur cette page : elle se débloque toute seule</li>
            </ol>
          </div>
        )}

        {state === 'unavailable' && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
            <p className="text-sm text-rose-800">
              Ce navigateur ne gère pas les notifications. Essayez avec Chrome, Edge ou Firefox à
              jour, et évitez la navigation privée.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={allow} disabled={busy} aria-busy={busy} className="btn-primary">
            {busy ? (
              'Vérification…'
            ) : definitive ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </>
            ) : (
              'Autoriser les notifications'
            )}
          </button>
        </div>

        <p className="mt-6 flex items-start gap-2 border-t border-ink-100 pt-4 text-xs text-ink-500">
          <LifeBuoy className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Si votre appareil ou votre réseau ne permet pas les notifications, demandez au Super
            Admin de dispenser votre compte depuis la page Utilisateurs.
          </span>
        </p>
      </div>
    </div>
  );
}
