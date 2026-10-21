# Automatisation des deploiements RISAC

Une fois la configuration decrite ici en place, un `git push` sur `main` suffit :
l'API est reconstruite et redeployee, et l'application Android part sur le canal
alpha du Play Store. Aucune intervention manuelle par la suite.

```
git push origin main
      │
      ├─ Northflank  ──► build Docker ──► API redeployee           (integration Git native)
      │
      └─ GitHub Actions
           ├─ backend-ci.yml    ──► compilation + image Docker     (garde-fou)
           └─ mobile-alpha.yml  ──► EAS build ──► Play Store alpha  (si mobile/ a change)
```

Le front Next.js suit le meme principe cote Vercel, qui redeploie seul a chaque
push (voir `docs/DEPLOIEMENT.md`).

---

## Qui deploie quoi

| Composant | Qui construit | Qui deploie | Declencheur |
|---|---|---|---|
| API NestJS | Northflank | Northflank | push sur `main` |
| Application Android | EAS Build | EAS Submit, via GitHub Actions | push sur `main` touchant `mobile/` |
| Front Next.js | Vercel | Vercel | push sur `main` |

`backend-ci.yml` ne deploie rien : il compile le backend et construit l'image
Docker pour que l'erreur apparaisse dans la pull request plutot qu'en
production. Northflank deploie en parallele, via sa propre integration Git.

---

## 1. Secrets a creer dans GitHub

**Settings > Secrets and variables > Actions > New repository secret**

| Nom | Contenu | Ou l'obtenir |
|---|---|---|
| `EXPO_TOKEN` | jeton d'acces Expo | https://expo.dev/settings/access-tokens > *Create token* |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | contenu **complet** du fichier JSON du compte de service, colle tel quel | etape 3 ci-dessous |

Ces deux secrets ne sont jamais ecrits dans le depot. Le workflow mobile
reconstitue le JSON dans un fichier temporaire, puis l'efface, meme en cas
d'echec.

Le job mobile teste la presence de ces deux secrets et s'ignore s'ils sont
absents : les workflows peuvent donc etre pousses avant d'etre configures,
sans produire d'execution en echec. Le job s'active de lui-meme des que les
secrets existent.

Aucun secret n'est necessaire pour le backend : Northflank detient lui-meme ses
variables d'environnement (voir `docs/NORTHFLANK.md`).

---

## 2. Compte Expo et projet EAS

1. Creer un compte sur https://expo.dev.
2. Depuis `mobile/`, lier le projet une seule fois :

   ```
   npx eas-cli login
   npx eas-cli init
   ```

   `eas init` ajoute `extra.eas.projectId` dans `app.json`. **Committer ce
   changement** : sans cet identifiant, les builds en CI echouent.

3. Renseigner l'URL de l'API dans `mobile/eas.json`. Les deux profils
   contiennent un marqueur a remplacer :

   ```
   "EXPO_PUBLIC_API_URL": "https://REMPLACER--risca.code.run/api"
   ```

   Mettre l'URL publique du service Northflank, suffixe `/api` compris. C'est
   ce que `mobile/app.config.js` injecte dans la configuration Expo au moment
   du build. **Tant que ce marqueur est la, l'application installee ne joindra
   aucun serveur.**

4. La signature Android est geree par EAS :

   ```
   npx eas-cli credentials
   ```

   Choisir Android > *Keystore* > *Generate new keystore*. EAS conserve la cle
   et la reutilise a chaque build. Sans cela, le Play Store refuse les mises a
   jour, les bundles n'etant pas signes par la meme cle.

---

## 3. Google Play : compte de service

Le workflow envoie les bundles via l'API Google Play, qui exige un compte de
service.

1. **Google Play Console > Parametres > Acces a l'API** : lier un projet Google
   Cloud, puis *Creer un compte de service*. Le lien ouvre la console Google
   Cloud.
2. Dans Google Cloud : *Creer un compte de service*, nom `risca-play-publisher`,
   sans role particulier. Puis onglet **Cles** > *Ajouter une cle* > *Creer une
   cle* > **JSON**. Le fichier est telecharge une seule fois.
3. Retour dans le Play Console > *Acces a l'API* : le compte de service
   apparait. Cliquer sur **Gerer les autorisations** et accorder, au minimum :
   - *Afficher les informations sur l'application*
   - *Gerer les versions de production, les versions exclues et les tests*
   Restreindre ces droits a l'application RISAC.
4. Coller le contenu du JSON dans le secret GitHub
   `GOOGLE_PLAY_SERVICE_ACCOUNT`.

Les autorisations mettent parfois jusqu'a 24 heures a se propager : un premier
envoi peut echouer en `403` juste apres la creation.

---

## 4. Premiere version : obligatoirement manuelle

**L'API Google Play ne peut pas creer la toute premiere version d'une
application.** Le premier bundle doit etre televerse a la main ; les suivants
passent par le workflow.

1. **Play Console > Creer une application** : nom `RISAC`, francais, gratuite.
2. Renseigner ce que le Play Console exige avant toute publication :
   politique de confidentialite, questionnaire sur le contenu, public cible,
   securite des donnees, coordonnees. Cette partie est longue et ne peut pas
   etre automatisee.
3. Construire un premier bundle depuis son poste :

   ```
   cd mobile
   npx eas-cli build --platform android --profile production
   ```

4. **Test > Test alpha (ferme) > Creer une version**, deposer le `.aab`
   telecharge, publier.

Verifier que le nom du paquet correspond a celui declare dans `app.json` :
`org.risac.app`. Il est definitif une fois l'application creee.

Apres cette premiere version, chaque push sur `main` touchant `mobile/` publie
seul sur le canal alpha.

---

## 5. Inviter les testeurs alpha

**Play Console > Test > Test alpha (ferme) > onglet Testeurs**

1. *Creer une liste de diffusion*, lui donner un nom (`Testeurs RISAC`).
2. Ajouter les adresses e-mail, une par ligne. Elles doivent etre des **comptes
   Google** : une adresse non Google ne pourra pas installer l'application.
3. Enregistrer, puis copier le **lien de participation** affiche en bas de la
   page (`https://play.google.com/apps/testing/org.risac.app`).
4. Envoyer ce lien aux testeurs. Chacun doit d'abord **accepter l'invitation**
   via le lien, sinon le Play Store lui repondra que l'application est
   introuvable.

Compter quelques minutes a quelques heures avant que l'application soit
installable apres publication d'une version.

### Pour qu'un testeur puisse se connecter

L'application pointe sur l'API Northflank, pas sur une base locale. Prevoir
donc que chaque testeur ait un compte :

- soit peupler la base avec le jeu de demonstration (`npm run seed` cote
  `backend`, voir `docs/NORTHFLANK.md`) et distribuer ces identifiants ;
- soit laisser les testeurs s'inscrire, l'activation passant par un code OTP
  envoye par e-mail — ce qui suppose les variables `SMTP_*` renseignees cote
  Northflank, sans quoi aucun code ne partira et personne ne pourra se
  connecter.

---

## 6. Numeros de version

Rien a gerer a la main. `eas.json` declare `appVersionSource: "remote"` et
`autoIncrement: true` : EAS tient le compteur de `versionCode` et l'incremente
a chaque build. Le Play Store refuse deux envois avec le meme `versionCode`.

Le `version` lisible par l'utilisateur (`1.0.0` dans `app.json`) reste manuel :
le modifier pour un changement notable.

---

## 7. Couts a connaitre

| Service | Gratuit ? |
|---|---|
| GitHub Actions | 2 000 minutes/mois sur depot prive, illimite si public |
| EAS Build | quota mensuel limite de builds gratuits, puis payant |
| Google Play Console | **25 $ une seule fois**, a la creation du compte |
| Northflank | voir https://northflank.com/pricing |

Le quota EAS gratuit est la premiere limite atteinte si chaque push declenche un
build Android. Pour l'economiser, remplacer dans `mobile-alpha.yml` le
declencheur `push` par un declencheur sur etiquette :

```yaml
on:
  push:
    tags: ['mobile-v*']
  workflow_dispatch:
```

Les publications se font alors sur commande (`git tag mobile-v1.0.1 && git push
--tags`) plutot qu'a chaque modification.
