'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { isPushConfigured, isPushSupported, pushPermission } from '@/lib/push';

type State = 'checking' | 'ready' | 'ask' | 'denied';

/**
 * Première étape de toute connexion ou création de compte : autoriser les notifications.
 *
 * Le navigateur ne peut demander l'autorisation qu'à l'ouverture d'une page et sur un geste de la personne : on la
 * demande donc ici, avant le formulaire. Le jeton de l'appareil est rattaché au compte juste après la connexion
 * (voir PushGate). Sans configuration Firebase ou sur un navigateur qui ne gère pas le push, rien n'est bloqué.
 * Un refus du navigateur n'enferme personne : l'écran explique comment le lever et laisse continuer ;
 * l'accès à l'espace reste soumis à l'activation (PushGate).
 */
export function PushFirst({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>('checking');
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!isPushConfigured() || !isPushSupported()) return setState('ready');
    const p = pushPermission();
    setState(p === 'granted' ? 'ready' : p === 'denied' ? 'denied' : 'ask');
  }, []);

  async function enable() {
    try {
      const result = await Notification.requestPermission();
      setState(result === 'granted' ? 'ready' : 'denied');
    } catch {
      setState('denied');
    }
  }

  if (state === 'ready' || skipped) return <>{children}</>;
  if (state === 'checking') return <div className="h-40" aria-hidden="true" />;

  return (
    <div className="space-y-4 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sun-100 text-sun-700">
        <BellRing className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="page-title">Activez les notifications</h1>
      <p className="text-sm leading-relaxed text-ink-600">
        Première étape : autorisez les notifications sur cet appareil. RISAC vous prévient dès qu’il y a du nouveau, même
        quand le site est fermé : publication, message, tâche à traiter, validation.
      </p>

      {state === 'ask' ? (
        <button type="button" onClick={enable} className="btn-primary w-full py-3">
          Activer les notifications
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-left text-sm text-amber-900">
          <p className="font-medium">Les notifications sont bloquées dans ce navigateur.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Cliquez le cadenas à gauche de l’adresse du site.</li>
            <li>Mettez « Notifications » sur « Autoriser ».</li>
            <li>Rechargez la page.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary px-3 text-xs">
              J’ai autorisé, recharger
            </button>
            <button type="button" onClick={() => setSkipped(true)} className="btn-outline px-3 text-xs">
              Continuer sans
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
