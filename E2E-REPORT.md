# Rapport de test E2E visuel — RISAC (web et mobile)

Date : 13 et 14 novembre 2026. Environnement local uniquement : aucune action contre la production.

## 1. Ce qui a été testé, et comment

| Volet | Méthode | Couverture |
|---|---|---|
| Données | `backend/prisma/simulate.ts` (`npm run simulate`) joue le métier **via l'API**, rôle par rôle, sur une base fraîche issue de `npm run seed` | 36 étapes, 12 rôles, 0 erreur, rejoué 2 fois sur base neuve |
| Web (Next.js) | Playwright avec le Chrome installé, **build de production** (`next build` + `next start`) | 12 rôles + visiteur, 45 pages `page.tsx` (graphe graphify), bureau 1440 et mobile 390 |
| Mobile (Expo SDK 58) | Version **web** d'Expo, viewport 390, même parcours que l'utilisateur | 12 rôles, chaque onglet + fiche enfant |
| Contrôle visuel | Captures pleine page relues, et pages ouvertes dans le navigateur intégré | voir § 4 |

### Résultat global

**504 tests sur 504 réussis**, après correction des bugs et ajustement du banc de test :

| Lot | Tests | Résultat |
|---|---|---|
| Connexion par le formulaire `/connexion` (12 rôles) | 12 | ✅ 12 |
| Pages web, bureau 1440 (12 rôles + visiteur) | 240 | ✅ 240 |
| Pages web, mobile 390 (12 rôles + visiteur) | 240 | ✅ 240 |
| Application mobile Expo (version web, 12 rôles) | 12 | ✅ 12 |

Chaque page vérifie : pas de redirection imprévue, pas de page d'erreur, aucune réponse HTTP 5xx, aucune exception JavaScript, aucune erreur console. Un seul avertissement subsiste, une ressource tierce indisponible (drapeau `flagcdn.com`, bug 5 b). Le site testé est le **build de production** (`next build`), plus fidèle au site déployé que le serveur de développement.

**Limite mobile, à lire.** Le SDK Android et un émulateur (`Pixel_7`) sont installés et l'émulateur démarre, mais ni Expo Go ni l'application RISAC n'y sont installés. Télécharger Expo Go n'a pas été autorisé : **l'application n'a pas été testée dans l'émulateur Android**. Le test mobile porte sur la version web d'Expo, qui partage le code des écrans mais pas le rendu natif (gestes, clavier, notifications push, stockage sécurisé).

### Environnement reproductible

Une base dédiée `risac_e2e` est utilisée, pour ne jamais toucher la base locale `risac` (qui contient le vrai compte Super Admin).

```bash
docker compose up -d postgres
docker exec risac_postgres psql -U risac -d risac -c "DROP DATABASE IF EXISTS risac_e2e WITH (FORCE)" -c "CREATE DATABASE risac_e2e"
cd backend && DATABASE_URL="postgresql://risac:risac_dev_pwd@localhost:5444/risac_e2e?schema=public" npx prisma db push --skip-generate
DATABASE_URL="postgresql://risac:risac_dev_pwd@localhost:5444/risac_e2e?schema=public" npm run seed
```

Démarrer ensuite les serveurs de `.claude/launch.json` : `risac-api-e2e` (API sur la base de test, avec `MAIL_ECHO_OTP=true` pour qu'aucun e-mail ne parte), `risac-web-prod` (après un `next build` qui force `NEXT_PUBLIC_API_URL=http://localhost:4000/api`, car `.env.production.local` vise l'API de production) et `risac-mobile-web-e2e` (Expo web forcé sur `http://localhost:4000/api`). Puis :

```bash
cd backend && npm run simulate
cd e2e && npm install && npx playwright test
```

## 2. Scénario simulé et ce que chaque tableau de bord montre

Ordre réel du métier, chaque action faite avec le compte du rôle concerné :

1. **Super Admin** : invite une ambassadrice, un agent de terrain et un partenaire (activés avec le code reçu), laisse une invitation en attente, valide la structure proposée « Centre Tumaini » et lui rattache l'ambassadrice.
2. **Directrice d'orphelinat** : crée le dossier de Furaha avec les justificatifs téléversés (acte de naissance, certificat de vulnérabilité, décision DIVAS), puis le soumet.
3. **Ambassadrice**, puis **chef régional** : valident le dossier, qui devient actif. Deux autres dossiers restent en attente (l'un chez l'ambassadrice, l'autre chez le chef régional), un brouillon et un dossier saisi par l'agent de terrain.
4. **Projet** « Réhabilitation du dortoir des filles » (2 500 USD) : soumis, validé par l'ambassadrice et le chef régional, publié. Un projet enfant (600 USD) reste à valider.
5. **Bailleurs et partenaires** : dons au projet, parrainage d'Amani (première échéance payée), dons pour une enfant et au fonds général, abonnement et favori. Un don reste en attente de paiement.
6. **Décaissements** : 800 USD demandés, confirmés par l'ambassadrice, payés par l'Admin Finance, justifiés (soldé). D'autres demandes restent à chaque étape : payée et partiellement justifiée, confirmée à payer, à confirmer (sur projet et sur le solde d'un enfant).
7. **Suivi de l'enfant** : évaluation psychologique initiale, bulletin scolaire, fiche santé, rapport de visite, publication.
8. **Modération** : un commentaire déplacé est signalé, masqué et traité. Un signalement grave, un signalement normal et deux tickets restent ouverts.
9. **Pilotage** : audit de label planifié, transfert demandé, annonce nationale diffusée.
10. **Auditrice éthique** : consulte le journal d'audit (107 entrées) et le rapprochement des comptes (équilibré).

Bilan affiché par l'API `GET /dashboard` en fin de simulation :

| Rôle | Tâches réelles visibles |
|---|---|
| Super Admin | 4 validations en attente, 2 signalements, 2 tickets, 1 compte invité |
| Admin Finance | 1 décaissement à payer, 1 en attente de justificatifs, 1 soldé |
| Modérateur | 2 signalements ouverts dont 1 grave, 2 tickets |
| Auditrice éthique | 1 signalement grave, journal de 107 entrées |
| Responsable national | 179,60 USD reçus pour des enfants, 1 200 USD décaissés |
| Chef régional | 1 validation, 1 audit planifié, 1 transfert à valider |
| Ambassadrice | 3 validations, 2 décaissements à confirmer, 4 enfants suivis |
| Agent de terrain | 1 enfant enregistré, 1 en validation |
| Directrice | 8 enfants dont 1 brouillon et 4 en validation, 1 justificatif attendu |
| Personnel (psychologue) | 1 séance, 2 enfants sans évaluation initiale |
| Bailleuse | 1 550 USD donnés, 1 enfant parrainé, 2 preuves de dépense |
| Partenaire | 500 USD versés, 1 projet cofinancé |

## 3. Bugs trouvés

| # | Gravité | Constat | Statut |
|---|---|---|---|
| 1 | Majeur | Les totaux « décaissé » (Super Admin, Admin Finance, Auditrice, Responsable national) ignoraient les décaissements **payés en attente de justificatifs** : 800 USD affichés au lieu de 1 200 USD. L'API passe un décaissement payé directement à `AWAITING_RECEIPTS`, alors que le total ne comptait que `PAID` et `SETTLED`. | **Corrigé** et déployé (`b765538`) : `ledger.service.ts` (`summary`) et `dashboard.service.ts` (national). Vérifié : 1 200 USD, cohérent avec le grand livre. |
| 2 | Majeur | Le compteur « Décaissements à confirmer » de l'ambassadeur ne comptait que les demandes liées à un enfant. Une demande sur projet ou sur la structure, que l'ambassadeur doit pourtant confirmer, n'apparaissait pas. | **Corrigé** et déployé (`b765538`) : `dashboard.service.ts` (ambassadeur). Vérifié : 2 au lieu de 1. |
| 3 | Mineur | Coquille sur la liste des décaissements : « demande le … » au lieu de « demandée le … ». | **Corrigé** et déployé (`b765538`) : `decaissements/page.tsx`. |
| 4 | Moyen | **Déconnexion avec plusieurs onglets.** Le jeton de rafraîchissement est à usage unique. Quand deux onglets rafraîchissent leur session en même temps, l'un d'eux reçoit un 401 et l'utilisateur est renvoyé à la connexion. Observé en test parallèle après 30 minutes (durée du jeton d'accès). | Non corrigé : touche la sécurité des sessions (tolérance de réutilisation ou rafraîchissement partagé entre onglets). À décider. |
| 5 | Majeur | **Google Fonts bloquait le chargement des pages.** La feuille de style était chargée depuis `fonts.googleapis.com` dans `<head>`. Quand le service traînait (3 à 4 s, parfois aucune réponse), le rendu attendait et l'événement `load` ne se déclenchait pas : la page `/connexion` est restée bloquée 2 minutes pendant un test. Impact direct pour les connexions lentes en RDC. | **Corrigé** : `layout.tsx` charge IBM Plex avec `next/font/google`, téléchargée au build et servie par le site ; `globals.css` pointe vers ces polices. Vérifié : même rendu, aucun hôte externe appelé sur l'accueil. Le téléchargement au build dépend de Google : un build local a échoué une fois sur un téléchargement interrompu, puis a réussi. |
| 5 b | Mineur | Le drapeau du pays (barre du haut) est chargé depuis `flagcdn.com`, avec les mêmes lenteurs intermittentes (erreurs console « Failed to load resource: net::ERR_… », drapeau absent). | Non corrigé : copier les drapeaux des pays couverts dans `public/flags/`. |
| 6 | Mineur | Application mobile : textes sans accents (« Decider », « element(s) attendent votre decision », « etape »). | Non corrigé. |
| 7 | Observation | Le webhook de paiement `POST /payments/webhook` est public et sans signature : n'importe qui connaissant une référence peut marquer un don comme payé. Normal en bac à sable, mais à sécuriser avant de brancher un vrai prestataire. | À traiter avec l'intégration des paiements. |
| 8 | Observation | « Fonds reçus » du responsable national ne compte que les dons liés à un enfant, pas les dons aux projets de ses structures. | À clarifier côté métier. |
| 9 | Mineur | Le tableau de bord du Super Admin annonce « 4 validations en attente », mais sa page Validations est vide : sa file ne montre que les étapes attribuées au rôle Super Admin, alors qu'il peut trancher toute étape. | Non corrigé : afficher les validations du réseau au Super Admin, ou renommer le compteur. |
| 10 | Mineur | Mobile 390 (web) : la date de la barre du haut est tronquée (« 14/11/2… »). Tableau de bord régional : titre « Post-majorite a preparer » sans accents. | Non corrigé. |

Ajustements du banc de test (pas des défauts de l'application) :
- chaque test ouvre sa propre session par l'API : partager une session sauvegardée entre tests parallèles finissait par les déconnecter (voir bug 4) ;
- la navigation attend le DOM puis l'activation de React, et non l'événement `load` qu'une ressource tierce lente peut retarder ;
- une validation réelle du réseau est ouverte pour les rôles dont la file personnelle est vide (Super Admin, national, directrice).

Faux positifs écartés pendant l'analyse, sans défaut applicatif :
- les pages `/…/nouveau` renvoient vers leur liste pour les rôles qui ne peuvent pas créer : c'est la garde voulue ;
- un premier test mobile ouvrait le profil public d'un enfant non encore actif : l'application, elle, ouvre le dossier interne pour le personnel ;
- le déploiement Cloudflare du commit `b765538` a d'abord échoué sur une erreur de l'API Cloudflare (`code 10013`), après un build réussi. Le job a été relancé et le site sert la nouvelle version.

## 4. Résultats détaillés par rôle

Légende : ✅ réussi, ❌ échec, ⏭️ ignoré (aucune donnée dans le périmètre du rôle). Chaque ligne renvoie à sa capture pleine page dans `e2e/screenshots/<projet>/<rôle>/`. Les connexions par le formulaire sont dans `e2e/screenshots/connexion/`. Les écrans de l'application mobile (lignes `expo-web-390`), de la connexion à la fiche enfant, sont dans `e2e/screenshots/expo-web-390/<rôle>/`.

Total : 504 tests — ✅ 504 passed


#### SUPER_ADMIN

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (admin@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/tableau-de-bord.png) |  |
| desktop-1440 | /enfants | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/enfants.png) |  |
| desktop-1440 | /enfants/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/enfants_nouveau.png) |  |
| desktop-1440 | /enfants/:id | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/enfants__id.png) |  |
| desktop-1440 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/enfants__id_mise-a-jour.png) |  |
| desktop-1440 | /orphelinats | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/orphelinats.png) |  |
| desktop-1440 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/orphelinats_nouveau.png) |  |
| desktop-1440 | /orphelinats/:id | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/orphelinats__id.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/projets_nouveau.png) |  |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/projets__id.png) |  |
| desktop-1440 | /validations | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/validations.png) |  |
| desktop-1440 | /validations/:id | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/validations__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/messages.png) |  |
| desktop-1440 | /finance | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/finance.png) |  |
| desktop-1440 | /decaissements | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/decaissements.png) |  |
| desktop-1440 | /decaissements/:id | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/decaissements__id.png) |  |
| desktop-1440 | /moderation | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/moderation.png) |  |
| desktop-1440 | /moderation/:id | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/moderation__id.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/support.png) |  |
| desktop-1440 | /journal-audit | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/journal-audit.png) |  |
| desktop-1440 | /utilisateurs | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/utilisateurs.png) | ressource externe indisponible : net::ERR_CONNECTION_CLOSED https://flagcdn.com/w40/cd.png<br>console : 1 erreur(s) |
| desktop-1440 | /modeles-dossier | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/modeles-dossier.png) |  |
| desktop-1440 | /parametres | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/parametres.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/SUPER_ADMIN/profil.png) |  |
| desktop-1440 | garde de route /mes-dons | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/tableau-de-bord.png) |  |
| mobile-390 | /enfants | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/enfants.png) |  |
| mobile-390 | /enfants/nouveau | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/enfants_nouveau.png) |  |
| mobile-390 | /enfants/:id | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/enfants__id.png) |  |
| mobile-390 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/enfants__id_mise-a-jour.png) |  |
| mobile-390 | /orphelinats | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/orphelinats.png) |  |
| mobile-390 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/orphelinats_nouveau.png) |  |
| mobile-390 | /orphelinats/:id | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/orphelinats__id.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/projets_nouveau.png) |  |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/projets__id.png) |  |
| mobile-390 | /validations | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/validations.png) |  |
| mobile-390 | /validations/:id | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/validations__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/messages.png) |  |
| mobile-390 | /finance | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/finance.png) |  |
| mobile-390 | /decaissements | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/decaissements.png) |  |
| mobile-390 | /decaissements/:id | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/decaissements__id.png) |  |
| mobile-390 | /moderation | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/moderation.png) |  |
| mobile-390 | /moderation/:id | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/moderation__id.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/support.png) |  |
| mobile-390 | /journal-audit | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/journal-audit.png) |  |
| mobile-390 | /utilisateurs | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/utilisateurs.png) |  |
| mobile-390 | /modeles-dossier | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/modeles-dossier.png) |  |
| mobile-390 | /parametres | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/parametres.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/SUPER_ADMIN/profil.png) |  |
| mobile-390 | garde de route /mes-dons | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### ADMIN_FINANCE

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (finance@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/tableau-de-bord.png) |  |
| desktop-1440 | /orphelinats | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/orphelinats.png) |  |
| desktop-1440 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/orphelinats_nouveau.png) |  |
| desktop-1440 | /orphelinats/:id | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/orphelinats__id.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/projets__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/messages.png) |  |
| desktop-1440 | /finance | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/finance.png) |  |
| desktop-1440 | /decaissements | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/decaissements.png) |  |
| desktop-1440 | /decaissements/:id | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/decaissements__id.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/support.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/ADMIN_FINANCE/profil.png) |  |
| desktop-1440 | garde de route /enfants | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/tableau-de-bord.png) |  |
| mobile-390 | /orphelinats | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/orphelinats.png) |  |
| mobile-390 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/orphelinats_nouveau.png) |  |
| mobile-390 | /orphelinats/:id | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/orphelinats__id.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/projets__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/messages.png) |  |
| mobile-390 | /finance | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/finance.png) |  |
| mobile-390 | /decaissements | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/decaissements.png) |  |
| mobile-390 | /decaissements/:id | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/decaissements__id.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/support.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/ADMIN_FINANCE/profil.png) |  |
| mobile-390 | garde de route /enfants | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### MODERATOR

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (moderation@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/tableau-de-bord.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/messages.png) |  |
| desktop-1440 | /moderation | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/moderation.png) |  |
| desktop-1440 | /moderation/:id | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/moderation__id.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/support.png) |  |
| desktop-1440 | /utilisateurs | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/utilisateurs.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/MODERATOR/profil.png) |  |
| desktop-1440 | garde de route /enfants | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/tableau-de-bord.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/messages.png) |  |
| mobile-390 | /moderation | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/moderation.png) |  |
| mobile-390 | /moderation/:id | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/moderation__id.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/support.png) |  |
| mobile-390 | /utilisateurs | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/utilisateurs.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/MODERATOR/profil.png) |  |
| mobile-390 | garde de route /enfants | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### ETHICS_AUDITOR

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (hcetde@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/tableau-de-bord.png) |  |
| desktop-1440 | /enfants | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/enfants.png) |  |
| desktop-1440 | /enfants/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/enfants_nouveau.png) |  |
| desktop-1440 | /enfants/:id | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/enfants__id.png) |  |
| desktop-1440 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/enfants__id_mise-a-jour.png) |  |
| desktop-1440 | /orphelinats | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/orphelinats.png) |  |
| desktop-1440 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/orphelinats_nouveau.png) |  |
| desktop-1440 | /orphelinats/:id | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/orphelinats__id.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/projets__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/messages.png) |  |
| desktop-1440 | /finance | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/finance.png) |  |
| desktop-1440 | /decaissements | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/decaissements.png) |  |
| desktop-1440 | /decaissements/:id | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/decaissements__id.png) |  |
| desktop-1440 | /moderation | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/moderation.png) |  |
| desktop-1440 | /moderation/:id | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/moderation__id.png) |  |
| desktop-1440 | /journal-audit | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/journal-audit.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/ETHICS_AUDITOR/profil.png) |  |
| desktop-1440 | garde de route /validations | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/tableau-de-bord.png) |  |
| mobile-390 | /enfants | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/enfants.png) |  |
| mobile-390 | /enfants/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/enfants_nouveau.png) |  |
| mobile-390 | /enfants/:id | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/enfants__id.png) |  |
| mobile-390 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/enfants__id_mise-a-jour.png) |  |
| mobile-390 | /orphelinats | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/orphelinats.png) |  |
| mobile-390 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/orphelinats_nouveau.png) |  |
| mobile-390 | /orphelinats/:id | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/orphelinats__id.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/projets__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/messages.png) |  |
| mobile-390 | /finance | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/finance.png) |  |
| mobile-390 | /decaissements | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/decaissements.png) |  |
| mobile-390 | /decaissements/:id | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/decaissements__id.png) |  |
| mobile-390 | /moderation | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/moderation.png) |  |
| mobile-390 | /moderation/:id | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/moderation__id.png) |  |
| mobile-390 | /journal-audit | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/journal-audit.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/ETHICS_AUDITOR/profil.png) |  |
| mobile-390 | garde de route /validations | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### NATIONAL_MANAGER

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (national.cd@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/tableau-de-bord.png) |  |
| desktop-1440 | /enfants | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/enfants.png) |  |
| desktop-1440 | /enfants/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/enfants_nouveau.png) |  |
| desktop-1440 | /enfants/:id | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/enfants__id.png) |  |
| desktop-1440 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/enfants__id_mise-a-jour.png) |  |
| desktop-1440 | /orphelinats | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/orphelinats.png) |  |
| desktop-1440 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/orphelinats_nouveau.png) |  |
| desktop-1440 | /orphelinats/:id | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/orphelinats__id.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/projets__id.png) |  |
| desktop-1440 | /validations | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/validations.png) |  |
| desktop-1440 | /validations/:id | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/validations__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/messages.png) |  |
| desktop-1440 | /decaissements | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/decaissements.png) |  |
| desktop-1440 | /decaissements/:id | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/decaissements__id.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/support.png) |  |
| desktop-1440 | /utilisateurs | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/utilisateurs.png) |  |
| desktop-1440 | /modeles-dossier | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/modeles-dossier.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/NATIONAL_MANAGER/profil.png) |  |
| desktop-1440 | garde de route /finance | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/tableau-de-bord.png) |  |
| mobile-390 | /enfants | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/enfants.png) |  |
| mobile-390 | /enfants/nouveau | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/enfants_nouveau.png) |  |
| mobile-390 | /enfants/:id | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/enfants__id.png) |  |
| mobile-390 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/enfants__id_mise-a-jour.png) |  |
| mobile-390 | /orphelinats | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/orphelinats.png) |  |
| mobile-390 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/orphelinats_nouveau.png) |  |
| mobile-390 | /orphelinats/:id | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/orphelinats__id.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/projets__id.png) |  |
| mobile-390 | /validations | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/validations.png) |  |
| mobile-390 | /validations/:id | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/validations__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/messages.png) |  |
| mobile-390 | /decaissements | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/decaissements.png) |  |
| mobile-390 | /decaissements/:id | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/decaissements__id.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/support.png) |  |
| mobile-390 | /utilisateurs | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/utilisateurs.png) |  |
| mobile-390 | /modeles-dossier | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/modeles-dossier.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/NATIONAL_MANAGER/profil.png) |  |
| mobile-390 | garde de route /finance | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### REGIONAL_MANAGER

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (regional.nordkivu@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/tableau-de-bord.png) |  |
| desktop-1440 | /enfants | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/enfants.png) |  |
| desktop-1440 | /enfants/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/enfants_nouveau.png) |  |
| desktop-1440 | /enfants/:id | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/enfants__id.png) |  |
| desktop-1440 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/enfants__id_mise-a-jour.png) |  |
| desktop-1440 | /orphelinats | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/orphelinats.png) |  |
| desktop-1440 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/orphelinats_nouveau.png) |  |
| desktop-1440 | /orphelinats/:id | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/orphelinats__id.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/projets_nouveau.png) |  |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/projets__id.png) |  |
| desktop-1440 | /validations | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/validations.png) |  |
| desktop-1440 | /validations/:id | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/validations__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/messages.png) |  |
| desktop-1440 | /decaissements | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/decaissements.png) |  |
| desktop-1440 | /decaissements/:id | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/decaissements__id.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/support.png) |  |
| desktop-1440 | /utilisateurs | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/utilisateurs.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/REGIONAL_MANAGER/profil.png) |  |
| desktop-1440 | garde de route /finance | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/tableau-de-bord.png) |  |
| mobile-390 | /enfants | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/enfants.png) |  |
| mobile-390 | /enfants/nouveau | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/enfants_nouveau.png) |  |
| mobile-390 | /enfants/:id | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/enfants__id.png) |  |
| mobile-390 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/enfants__id_mise-a-jour.png) |  |
| mobile-390 | /orphelinats | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/orphelinats.png) |  |
| mobile-390 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/orphelinats_nouveau.png) |  |
| mobile-390 | /orphelinats/:id | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/orphelinats__id.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/projets_nouveau.png) |  |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/projets__id.png) |  |
| mobile-390 | /validations | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/validations.png) |  |
| mobile-390 | /validations/:id | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/validations__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/messages.png) |  |
| mobile-390 | /decaissements | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/decaissements.png) |  |
| mobile-390 | /decaissements/:id | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/decaissements__id.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/support.png) |  |
| mobile-390 | /utilisateurs | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/utilisateurs.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/REGIONAL_MANAGER/profil.png) |  |
| mobile-390 | garde de route /finance | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### AMBASSADOR

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (ambassadeur1@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/tableau-de-bord.png) |  |
| desktop-1440 | /enfants | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/enfants.png) |  |
| desktop-1440 | /enfants/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/enfants_nouveau.png) |  |
| desktop-1440 | /enfants/:id | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/enfants__id.png) |  |
| desktop-1440 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/enfants__id_mise-a-jour.png) |  |
| desktop-1440 | /orphelinats | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/orphelinats.png) |  |
| desktop-1440 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/orphelinats_nouveau.png) |  |
| desktop-1440 | /orphelinats/:id | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/orphelinats__id.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/projets_nouveau.png) |  |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/projets__id.png) |  |
| desktop-1440 | /validations | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/validations.png) |  |
| desktop-1440 | /validations/:id | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/validations__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/messages.png) |  |
| desktop-1440 | /decaissements | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/decaissements.png) |  |
| desktop-1440 | /decaissements/:id | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/decaissements__id.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/support.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/AMBASSADOR/profil.png) |  |
| desktop-1440 | garde de route /finance | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/tableau-de-bord.png) |  |
| mobile-390 | /enfants | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/enfants.png) |  |
| mobile-390 | /enfants/nouveau | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/enfants_nouveau.png) |  |
| mobile-390 | /enfants/:id | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/enfants__id.png) |  |
| mobile-390 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/enfants__id_mise-a-jour.png) |  |
| mobile-390 | /orphelinats | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/orphelinats.png) |  |
| mobile-390 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/orphelinats_nouveau.png) |  |
| mobile-390 | /orphelinats/:id | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/orphelinats__id.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/projets_nouveau.png) |  |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/projets__id.png) |  |
| mobile-390 | /validations | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/validations.png) |  |
| mobile-390 | /validations/:id | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/validations__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/messages.png) |  |
| mobile-390 | /decaissements | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/decaissements.png) |  |
| mobile-390 | /decaissements/:id | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/decaissements__id.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/support.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/AMBASSADOR/profil.png) |  |
| mobile-390 | garde de route /finance | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### FIELD_AGENT

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (agent.terrain@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/tableau-de-bord.png) |  |
| desktop-1440 | /enfants | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/enfants.png) |  |
| desktop-1440 | /enfants/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/enfants_nouveau.png) |  |
| desktop-1440 | /enfants/:id | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/enfants__id.png) |  |
| desktop-1440 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/enfants__id_mise-a-jour.png) |  |
| desktop-1440 | /orphelinats | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/orphelinats.png) |  |
| desktop-1440 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/orphelinats_nouveau.png) |  |
| desktop-1440 | /orphelinats/:id | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/orphelinats__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/messages.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/support.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/FIELD_AGENT/profil.png) |  |
| desktop-1440 | garde de route /projets | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/tableau-de-bord.png) |  |
| mobile-390 | /enfants | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/enfants.png) |  |
| mobile-390 | /enfants/nouveau | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/enfants_nouveau.png) |  |
| mobile-390 | /enfants/:id | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/enfants__id.png) |  |
| mobile-390 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/enfants__id_mise-a-jour.png) |  |
| mobile-390 | /orphelinats | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/orphelinats.png) |  |
| mobile-390 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/orphelinats_nouveau.png) |  |
| mobile-390 | /orphelinats/:id | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/orphelinats__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/messages.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/support.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/FIELD_AGENT/profil.png) |  |
| mobile-390 | garde de route /projets | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### ORPHANAGE_DIRECTOR

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (chef.espoir@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/tableau-de-bord.png) |  |
| desktop-1440 | /enfants | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/enfants.png) |  |
| desktop-1440 | /enfants/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/enfants_nouveau.png) |  |
| desktop-1440 | /enfants/:id | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/enfants__id.png) |  |
| desktop-1440 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/enfants__id_mise-a-jour.png) |  |
| desktop-1440 | /orphelinats | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/orphelinats.png) |  |
| desktop-1440 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/orphelinats_nouveau.png) |  |
| desktop-1440 | /orphelinats/:id | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/orphelinats__id.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/projets_nouveau.png) |  |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/projets__id.png) |  |
| desktop-1440 | /validations | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/validations.png) |  |
| desktop-1440 | /validations/:id | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/validations__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/messages.png) |  |
| desktop-1440 | /decaissements | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/decaissements.png) |  |
| desktop-1440 | /decaissements/:id | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/decaissements__id.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/support.png) |  |
| desktop-1440 | /utilisateurs | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/utilisateurs.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_DIRECTOR/profil.png) |  |
| desktop-1440 | garde de route /finance | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/tableau-de-bord.png) |  |
| mobile-390 | /enfants | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/enfants.png) |  |
| mobile-390 | /enfants/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/enfants_nouveau.png) |  |
| mobile-390 | /enfants/:id | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/enfants__id.png) |  |
| mobile-390 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/enfants__id_mise-a-jour.png) |  |
| mobile-390 | /orphelinats | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/orphelinats.png) |  |
| mobile-390 | /orphelinats/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/orphelinats_nouveau.png) |  |
| mobile-390 | /orphelinats/:id | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/orphelinats__id.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/projets_nouveau.png) |  |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/projets__id.png) |  |
| mobile-390 | /validations | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/validations.png) |  |
| mobile-390 | /validations/:id | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/validations__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/messages.png) |  |
| mobile-390 | /decaissements | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/decaissements.png) |  |
| mobile-390 | /decaissements/:id | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/decaissements__id.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/support.png) |  |
| mobile-390 | /utilisateurs | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/utilisateurs.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_DIRECTOR/profil.png) |  |
| mobile-390 | garde de route /finance | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### ORPHANAGE_STAFF

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (psychologue.espoir@risac.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/tableau-de-bord.png) |  |
| desktop-1440 | /enfants | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/enfants.png) |  |
| desktop-1440 | /enfants/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/enfants_nouveau.png) |  |
| desktop-1440 | /enfants/:id | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/enfants__id.png) |  |
| desktop-1440 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/enfants__id_mise-a-jour.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/messages.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/support.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/ORPHANAGE_STAFF/profil.png) |  |
| desktop-1440 | garde de route /orphelinats | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/tableau-de-bord.png) |  |
| mobile-390 | /enfants | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/enfants.png) |  |
| mobile-390 | /enfants/nouveau | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/enfants_nouveau.png) |  |
| mobile-390 | /enfants/:id | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/enfants__id.png) |  |
| mobile-390 | /enfants/:id/mise-a-jour | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/enfants__id_mise-a-jour.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/messages.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/support.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/ORPHANAGE_STAFF/profil.png) |  |
| mobile-390 | garde de route /orphelinats | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### DONOR

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (bailleur1@example.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/tableau-de-bord.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/projets__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/messages.png) |  |
| desktop-1440 | /mes-dons | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/mes-dons.png) |  |
| desktop-1440 | /mes-parrainages | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/mes-parrainages.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/support.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/DONOR/profil.png) |  |
| desktop-1440 | garde de route /enfants | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/DONOR/tableau-de-bord.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/DONOR/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/DONOR/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/DONOR/projets__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/DONOR/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/DONOR/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/DONOR/messages.png) |  |
| mobile-390 | /mes-dons | ✅ | [png](e2e/screenshots/mobile-390/DONOR/mes-dons.png) |  |
| mobile-390 | /mes-parrainages | ✅ | [png](e2e/screenshots/mobile-390/DONOR/mes-parrainages.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/DONOR/support.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/DONOR/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/DONOR/profil.png) |  |
| mobile-390 | garde de route /enfants | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### PARTNER

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| setup | connexion  (partenaire@example.org) | ✅ |  |  |
| desktop-1440 | /tableau-de-bord | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/tableau-de-bord.png) |  |
| desktop-1440 | /projets | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/projets.png) |  |
| desktop-1440 | /projets/nouveau | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| desktop-1440 | /projets/:id | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/projets__id.png) |  |
| desktop-1440 | /communication | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/communication.png) |  |
| desktop-1440 | /communication/:id | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/communication__id.png) |  |
| desktop-1440 | /messages | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/messages.png) |  |
| desktop-1440 | /mes-dons | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/mes-dons.png) |  |
| desktop-1440 | /mes-parrainages | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/mes-parrainages.png) |  |
| desktop-1440 | /support | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/support.png) |  |
| desktop-1440 | /notifications | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/notifications.png) |  |
| desktop-1440 | /profil | ✅ | [png](e2e/screenshots/desktop-1440/PARTNER/profil.png) |  |
| desktop-1440 | garde de route /enfants | ✅ |  |  |
| mobile-390 | /tableau-de-bord | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/tableau-de-bord.png) |  |
| mobile-390 | /projets | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/projets.png) |  |
| mobile-390 | /projets/nouveau | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/projets_nouveau.png) | création non autorisée : renvoyé vers /projets |
| mobile-390 | /projets/:id | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/projets__id.png) |  |
| mobile-390 | /communication | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/communication.png) |  |
| mobile-390 | /communication/:id | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/communication__id.png) |  |
| mobile-390 | /messages | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/messages.png) |  |
| mobile-390 | /mes-dons | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/mes-dons.png) |  |
| mobile-390 | /mes-parrainages | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/mes-parrainages.png) |  |
| mobile-390 | /support | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/support.png) |  |
| mobile-390 | /notifications | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/notifications.png) |  |
| mobile-390 | /profil | ✅ | [png](e2e/screenshots/mobile-390/PARTNER/profil.png) |  |
| mobile-390 | garde de route /enfants | ✅ |  |  |
| expo-web-390 | EXPO  : connexion et onglets | ✅ |  |  |

#### VISITEUR

| Projet | Page / écran | Résultat | Capture | Remarques |
|---|---|---|---|---|
| desktop-1440 | / | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/accueil.png) |  |
| desktop-1440 | /confidentialite | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/confidentialite.png) |  |
| desktop-1440 | /don-fonds-general | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/don-fonds-general.png) |  |
| desktop-1440 | /enfants-a-soutenir | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/enfants-a-soutenir.png) |  |
| desktop-1440 | /enfants-a-soutenir/:id | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/enfants-a-soutenir__id.png) |  |
| desktop-1440 | /partenaires | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/partenaires.png) |  |
| desktop-1440 | /projets-ouverts | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/projets-ouverts.png) |  |
| desktop-1440 | /projets-ouverts/:id | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/projets-ouverts__id.png) |  |
| desktop-1440 | /structures | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/structures.png) |  |
| desktop-1440 | /transparence | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/transparence.png) |  |
| desktop-1440 | /don/paiement/:id | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/don_paiement__id.png) |  |
| desktop-1440 | /connexion | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/connexion.png) |  |
| desktop-1440 | /inscription | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/inscription.png) |  |
| desktop-1440 | /admin | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/admin.png) |  |
| desktop-1440 | /activate | ✅ | [png](e2e/screenshots/desktop-1440/VISITEUR/activate.png) |  |
| mobile-390 | / | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/accueil.png) |  |
| mobile-390 | /confidentialite | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/confidentialite.png) |  |
| mobile-390 | /don-fonds-general | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/don-fonds-general.png) |  |
| mobile-390 | /enfants-a-soutenir | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/enfants-a-soutenir.png) |  |
| mobile-390 | /enfants-a-soutenir/:id | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/enfants-a-soutenir__id.png) |  |
| mobile-390 | /partenaires | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/partenaires.png) |  |
| mobile-390 | /projets-ouverts | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/projets-ouverts.png) |  |
| mobile-390 | /projets-ouverts/:id | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/projets-ouverts__id.png) |  |
| mobile-390 | /structures | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/structures.png) |  |
| mobile-390 | /transparence | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/transparence.png) |  |
| mobile-390 | /don/paiement/:id | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/don_paiement__id.png) |  |
| mobile-390 | /connexion | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/connexion.png) |  |
| mobile-390 | /inscription | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/inscription.png) |  |
| mobile-390 | /admin | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/admin.png) |  |
| mobile-390 | /activate | ✅ | [png](e2e/screenshots/mobile-390/VISITEUR/activate.png) |  |

