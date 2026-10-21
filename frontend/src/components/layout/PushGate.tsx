'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, LifeBuoy, RefreshCw, ShieldAlert } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { isPushConfigured, isPushSupported, pushPermission, registerWebPush } from '@/lib/push';

type State = 'checking' | 'granted' | 'refused' | 'blocked' | 'unavailable';

/**
 * Accès conditionné à l'activation des notifications.
 *
 * Les alertes de validation, de décaissement et de protection de l'enfance
 * doivent atteindre leur destinataire : l'accès est donc refusé tant que
 * l'appareil n'est pas enregistré.
 *
 * Deux garde-fous indispensables :
 * - si les notifications ne sont pas configurées sur l'installation, rien n'est
 *   bloqué, sans quoi un déploiement sans Firebase mettrait tout le monde dehors ;
 * - un refus définitif du navigateur n'enferme personne : l'écran explique
 *   comment le lever, et le Super Admin peut dispenser un compte.
 */
export function PushGate({ exempt, children }: { exempt?: boolean; children: React.ReactNode }) {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(async (ask: boolean) => {
    // Sans configuration Firebase, aucun blocage possible : on laisse passer.
    if (!isPushConfigured()) {
      setState('granted');
      return;
    }
    if (!isPushSupported()) {
      setState('unavailable');
      return;
    }
    const ok = await registerWebPush(ask);
    if (ok) {
      setState('granted');
      return;
    }
    setState(pushPermission() === 'denied' ? 'blocked' : 'refused');
  }, []);

  useEffect(() => {
    if (exempt) {
      setState('granted');
      return;
    }
    void attempt(true);
  }, [exempt, attempt]);

  async function retry() {
    setBusy(true);
    await attempt(true);
    setBusy(false);
  }

  if (exempt || state === 'granted') return <>{children}</>;

  if (state === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
        <p className="text-sm text-ink-500">Vérification des notifications…</p>
      </div>
    );
  }

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
              Votre navigateur attend votre réponse. Cliquez ci-dessous, puis choisissez
              <strong className="font-medium"> Autoriser</strong> dans la fenêtre qu&apos;il affiche.
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
              <li>Revenez ici et cliquez sur Réessayer</li>
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
          <button onClick={retry} disabled={busy} aria-busy={busy} className="btn-primary">
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
