# Notifications push — RISAC

Chaque opération qui crée une notification dans RISAC envoie aussi une notification
push aux appareils enregistrés de la personne concernée. Le transport est Firebase
Cloud Messaging, appelé directement par l'API, sans service de relais.

## Comment ça marche

Les 23 endroits du code qui notifient passent tous par `NotificationsService`
(`backend/src/common/services/notifications.service.ts`). Le push est branché à cet
endroit unique : aucune règle métier n'a été modifiée, et toute notification ajoutée
plus tard partira automatiquement en push.

```
opération métier
      │
      ▼
NotificationsService.notify / notifyMany / broadcast
      │                               │
      ▼                               ▼
Notification en base            PushService.sendToUsers
(cloche dans l'app)                   │
                                      ▼
                            Firebase Cloud Messaging
                                      │
                      ┌───────────────┼───────────────┐
                      ▼               ▼               ▼
                  Android            iOS          Navigateur
```

L'envoi est volontairement détaché : une panne de Firebase est journalisée mais
**n'annule jamais** l'opération métier qui l'a déclenchée. Sans configuration
Firebase, la plateforme fonctionne exactement comme avant.

## Contenu affiché et vie privée

Un push s'affiche sur un écran verrouillé, donc potentiellement devant un tiers.
Les notifications marquées `sensitive: true` n'affichent qu'un texte neutre ; le
détail reste dans l'application. C'est le cas de :

| Notification | Texte sur l'appareil |
| --- | --- |
| « Nouvelle publication sur *prénom* » | « Une nouvelle information vous attend. » |
| « Avertissement » et son motif | « Une décision de modération vous concerne. » |

Pour marquer une nouvelle notification comme sensible, ajoutez `sensitive: true`
à l'appel `notify`. Les données techniques envoyées avec le push ne contiennent que
le type et le lien de navigation, jamais de donnée personnelle.

## Mise en place côté Firebase

1. Créer un projet sur la console Firebase (un seul projet couvre Android, iOS et web).
2. **Compte de service** : Paramètres du projet → Comptes de service → Générer une
   nouvelle clé privée. Reporter les valeurs dans `backend/.env` :

   ```
   FIREBASE_PROJECT_ID="..."
   FIREBASE_CLIENT_EMAIL="..."
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
"
   ```

   Variante : `GOOGLE_APPLICATION_CREDENTIALS` pointant vers le fichier JSON.
   Ces fichiers sont déjà exclus du dépôt par `.gitignore`.

3. **Android** : ajouter une application Android (`org.risac.app`), télécharger
   `google-services.json` et le placer dans `mobile/`.
4. **iOS** : ajouter une application iOS (`org.risac.app`), téléverser une clé
   d'authentification APNs dans Firebase, et placer `GoogleService-Info.plist`
   dans `mobile/`.
5. **Web** : Paramètres du projet → Cloud Messaging → générer une paire de clés
   Web Push. Reporter dans `frontend/.env.local` les variables listées dans
   `frontend/.env.example`, dont `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.

## Mobile : Expo Go ne suffit pas

Le push distant **ne fonctionne pas dans Expo Go** (Android depuis le SDK 53, et
jamais sur iOS). Il faut une build de développement :

```bash
cd mobile
npx expo install expo-notifications   # deja dans package.json
npx expo run:android                  # ou: eas build --profile development
```

`app.json` déclare déjà le plugin `expo-notifications`, les emplacements des
fichiers Firebase et le mode `remote-notification` pour iOS.

## Où ça se passe dans le code

| Fichier | Rôle |
| --- | --- |
| `backend/prisma/schema.prisma` | Modèle `Device` et enum `DevicePlatform` |
| `backend/src/common/services/push.service.ts` | Envoi FCM, lots de 500, purge des jetons morts |
| `backend/src/common/services/notifications.service.ts` | Branchement unique du push |
| `backend/src/modules/notifications/devices.service.ts` | Enregistrement et retrait des appareils |
| `frontend/src/lib/push.ts` | Jeton web, autorisation, enregistrement |
| `frontend/public/firebase-messaging-sw.js` | Réception onglet fermé, clic vers la bonne page |
| `frontend/src/components/users/PushSection.tsx` | Activation depuis le profil |
| `mobile/src/lib/push.ts` | Jeton natif FCM/APNs, canaux Android |

## Points de vigilance

- **Appareil partagé** : un jeton appartient à une installation, pas à une personne.
  Si quelqu'un d'autre se connecte sur le même téléphone, le jeton change de
  propriétaire et l'événement est inscrit au journal d'audit (`DEVICE_REASSIGNED`).
  La déconnexion retire l'appareil.
- **Diffusion générale** : une diffusion à tous les rôles envoie autant de push que
  de comptes actifs. Les envois sont découpés en lots de 500, mais il n'existe pas
  encore de préférence par type de notification ni d'heures calmes.
- **Jetons morts** : un jeton refusé par Firebase est supprimé automatiquement.
