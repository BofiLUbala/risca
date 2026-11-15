import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Mises à jour automatiques de l'application (EAS Update).
 *
 * Chaque push sur `mobile/` publie une mise à jour (workflow « Mobile — mise à jour automatique ») :
 *  - à l'ouverture, l'application la télécharge et redémarre aussitôt dessus (l'utilisateur vient d'arriver,
 *    il ne perd rien) ;
 *  - au retour au premier plan, elle la télécharge seulement : elle s'appliquera à la prochaine ouverture,
 *    pour ne jamais interrompre une saisie en cours.
 * Une modification native (nouveau module) change la version d'exécution : elle passe alors par le Play Store.
 */
export function useAutoUpdates() {
  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;
    let busy = false;

    async function check(applyNow: boolean) {
      if (busy) return;
      busy = true;
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          await Updates.fetchUpdateAsync();
          if (applyNow) await Updates.reloadAsync();
        }
      } catch {
        /* hors ligne ou serveur indisponible : on réessaiera plus tard */
      } finally {
        busy = false;
      }
    }

    void check(true);
    let last = Date.now();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - last > 10 * 60000) {
        last = Date.now();
        void check(false);
      }
    });
    return () => sub.remove();
  }, []);
}
