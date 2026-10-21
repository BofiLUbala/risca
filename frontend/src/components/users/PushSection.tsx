'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { BellRing, Laptop, Smartphone } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { isPushConfigured, isPushSupported, pushPermission, registerWebPush } from '@/lib/push';

const PLATFORM_LABEL: Record<string, string> = {
  WEB: 'Navigateur',
  ANDROID: 'Android',
  IOS: 'iPhone ou iPad',
};

/**
 * Notifications push : autorisation du navigateur et liste des appareils
 * enregistrés. Chaque opération de la plateforme qui crée une notification
 * déclenche aussi un envoi vers ces appareils.
 */
export function PushSection() {
  const { data: devices, mutate } = useSWR<any[]>('/notifications/devices', fetcher);
  const [permission, setPermission] = useState<string>('unsupported');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // L'état de l'autorisation n'existe que dans le navigateur, jamais au rendu serveur.
  useEffect(() => {
    setPermission(pushPermission());
  }, []);

  const configured = isPushConfigured();
  const supported = isPushSupported();

  async function enable() {
    setBusy(true);
    setNotice(null);
    const ok = await registerWebPush(true);
    setPermission(pushPermission());
    setNotice(
      ok
        ? { ok: true, text: 'Ce navigateur recevra désormais les alertes RISAC.' }
        : {
            ok: false,
            text:
              pushPermission() === 'denied'
                ? 'Autorisation refusée. Réactivez les notifications pour ce site dans les réglages du navigateur.'
                : 'L’activation n’a pas abouti. Vérifiez la configuration Firebase.',
          },
    );
    mutate();
    setBusy(false);
  }

  return (
    <section className="card card-pad">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
        <BellRing className="h-4 w-4" />
        Notifications push
      </h2>

      {!configured ? (
        <p className="text-sm text-ink-500">
          Les notifications push ne sont pas configurées sur cette installation. Les alertes restent
          consultables dans la cloche en haut de page.
        </p>
      ) : !supported ? (
        <p className="text-sm text-ink-500">
          Ce navigateur ne gère pas les notifications push. Les alertes restent consultables dans la
          cloche en haut de page.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-500">
            {permission === 'granted'
              ? 'Ce navigateur est autorisé à afficher les alertes, même onglet fermé.'
              : permission === 'denied'
                ? 'Les notifications sont bloquées pour ce site dans les réglages du navigateur.'
                : 'Recevez les validations, les décaissements et les alertes de suivi sans garder l’onglet ouvert.'}
          </p>

          {permission !== 'granted' && permission !== 'denied' && (
            <button onClick={enable} disabled={busy} aria-busy={busy} className="btn-primary">
              {busy ? 'Activation…' : 'Activer sur ce navigateur'}
            </button>
          )}
        </>
      )}

      {notice && (
        <p
          role="status"
          className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
            notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      {!!devices?.length && (
        <div className="mt-5 border-t border-ink-100 pt-4">
          <h3 className="card-title mb-2">Appareils enregistrés</h3>
          <ul className="divide-y divide-ink-50">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                {d.platform === 'WEB' ? (
                  <Laptop className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                ) : (
                  <Smartphone className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-900">
                    {PLATFORM_LABEL[d.platform] ?? d.platform}
                  </p>
                  <p className="truncate meta">
                    {d.label ? `${d.label} · ` : ''}
                    vu {dateTime(d.lastSeenAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="meta mt-2">
            Un appareil se retire depuis l’appareil lui-même, en se déconnectant.
          </p>
        </div>
      )}
    </section>
  );
}
