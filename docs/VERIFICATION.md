# Rapport de vérification — RISAC

Date : 8 octobre 2026

## 1. Plateformes testées

| Plateforme | Comment | Résultat |
| --- | --- | --- |
| API NestJS | `node test/run-e2e.js` contre l'API réelle + PostgreSQL | **156/156** vérifications |
| Web, grand écran | Chrome 1024×768, connexion réelle Super Admin | OK |
| Web, petit écran | Chrome 375×812, tiroir de navigation | OK |
| Mobile (Expo SDK 57) | Metro + navigateur 375×812, connexion réelle Ambassadeur | OK |
| Compilation | `tsc --noEmit` backend et mobile, `next build` web | 0 erreur, 31 routes web |

## 2. Couverture fonctionnelle du test de bout en bout

Les 156 vérifications parcourent les circuits réels, pas des bouchons.

**Authentification et rôles** — connexion des 14 comptes de démonstration couvrant les
12 rôles ; mot de passe invalide rejeté (401) ; accès sans jeton refusé (401).

**Périmètres de visibilité** — le Super Admin voit tous les enfants ; un ambassadeur ne
voit que ses enfants assignés ; un second ambassadeur voit les siens ; le chef
d'orphelinat est limité à sa structure ; le chef régional à sa province.

**Profil public et confidentialité** — fil public accessible sans compte ; le nom de
famille n'apparaît jamais ; seuls les dossiers actifs sont publics ; le bailleur ne voit
ni le volet santé ni le nom de famille.

**Psychotrauma (très confidentiel)** — le psychologue y accède et peut saisir une
séance ; l'éducateur est refusé en lecture (403) et en écriture (403) ; l'Auditeur
Éthique y accède.

**Auditeur Éthique en lecture seule** — toute écriture est refusée (403).

**Circuit de validation du dossier enfant** — création par le chef d'orphelinat ;
détection de doublon (score 90) ; soumission ; apparition dans la file de l'ambassadeur
assigné ; un autre ambassadeur ne peut pas valider (403) ; validation par l'ambassadeur
puis passage à l'étape du chef régional ; validation finale ; activation du dossier.

**Mise à jour et historique** — le chef d'orphelinat propose sans appliquer ; la
proposition validée est appliquée ; l'ambassadeur assigné modifie directement ; les
versions sont conservées ; la comparaison de versions fonctionne ; l'historique retrace
les événements.

**Publications et protection de l'enfant** — publication avec photo bloquée sans
consentement ; autorisée après consentement ; le nom de famille, les données médicales
et l'adresse exacte sont bloqués automatiquement ; le chef d'orphelinat ne publie pas
pour un enfant ; un ambassadeur ne publie pas pour un enfant qui ne lui est pas assigné.

**Interactions et modération** — réaction, commentaire, commentaire contenant un e-mail
bloqué, abonnement, fil public ; le modérateur masque et rétablit ; un ambassadeur ne
peut pas masquer ; signalement normal et grave ; l'Auditeur Éthique ne reçoit que les
signalements graves.

**Circuit de l'argent** — frais annoncés avant paiement (5 %) ; conversion multi-devises
(100 EUR = 108 USD) ; URL de paiement web renvoyée, pas d'achat intégré ; le webhook
règle le don ; le rejeu du webhook n'écrit pas deux fois ; le solde de l'enfant est
crédité du net (190 sur 200) ; les frais sont isolés (+10) ; rapprochement équilibré.

**Parrainage** — création mensuelle avec date de fin ; double parrainage du même bailleur
refusé ; pause, reprise, modification du montant ; un tiers ne peut pas annuler.

**Séparation des pouvoirs** — l'ambassadeur ne peut pas demander de décaissement (403) ;
le chef d'orphelinat demande ; le paiement est bloqué avant confirmation (400) ;
l'ambassadeur confirme ; le chef d'orphelinat ne peut pas se payer lui-même (403) ;
l'Admin Finance décaisse ; le solde est débité (190 → 70) ; une demande supérieure au
solde est refusée ; justificatif téléversé ; dépense soldée ; le bailleur voit la preuve ;
comptes toujours équilibrés.

**Projets** — création, soumission, une seule étape sous le seuil, validation par
l'ambassadeur de l'enfant, publication ; au-dessus du seuil une étape chef régional est
ajoutée ; contribution et mise à jour de la jauge.

**Messagerie** — canaux visibles, envoi et lecture, non-membre refusé (403), canal
général en lecture seule pour les non-admins, écriture autorisée pour un administrateur ;
canal bailleur ouvert car parrainage actif, coordonnées personnelles bloquées (400),
canal refusé sans parrainage (403), message masqué par le modérateur.

**Support** — ticket ouvert, réponse, résolution.

**Comptes** — invitation avec lien d'activation, activation, lien non réutilisable (400),
blocage par le Super Admin, connexion impossible ensuite (403), gel par l'Auditeur
Éthique, gel refusé à un ambassadeur (403).

**Tableaux de bord** — les 12 rôles renvoient leur tableau de bord dédié ; le Super Admin
agrège les chiffres clés ; « Mon impact » affiche les totaux du bailleur ; le tableau
Finance expose le rapprochement.

**Journal d'audit et paramètres** — journal consultable par l'Auditeur Éthique, refusé
aux autres rôles (403) ; paramètres lisibles et seuil modifiable.

**Modèle de dossier par pays** — le modèle RDC contient l'acte de naissance et le
certificat de vulnérabilité (24 champs) ; le modèle Belgique diffère (16 champs) ; tronc
commun partagé ; un champ peut être ajouté sans changement de code ; un ambassadeur ne
peut pas modifier le modèle (403).

**Géographie** — 12 pays, les 26 provinces de la RDC, 4 zones à risque marquées
(Ituri, Maniema, Nord-Kivu, Sud-Kivu).

**Notifications** — notifications reçues, diffusion ciblée par rôle, compteur de non-lus.

## 3. Vérification visuelle

**Web, grand écran** — page d'accueil publique avec données réelles (profils publics,
âges, besoins, badge « Sans parrain ») ; connexion Super Admin ; tableau de bord avec
navigation des fonctionnalités à gauche et détail à droite, chiffres réels
(19 utilisateurs, 6 enfants, 600 USD collectés, 2/150 structures labellisées).

**Web, petit écran** — la navigation devient un tiroir, les cartes s'empilent, aucun
défilement horizontal.

**Mobile** — connexion Ambassadeur ; tableau de bord (4 enfants, 1 à valider, 200 USD
levés, rappels) ; onglet Enfants avec les 4 dossiers du périmètre et leurs statuts ;
onglet Fil avec le composer et une publication réelle (réactions, commentaires, bouton
Soutenir) ; onglet Profil avec notifications réelles.

## 4. Défauts trouvés et corrigés pendant la vérification

| Défaut | Correction |
| --- | --- |
| Alerte de visite affichant « Aucune visite depuis **toujours** jours » quand aucune visite n'existe | Message distinct : « Aucune visite enregistrée à ce jour » (`timeline.service.ts`) |
| Libellés de la barre d'onglets mobile tronqués | Hauteur portée à 74 px hors iOS, marges d'icône et de libellé ajustées |
| Assertion de test sur les frais supposant une base vierge | Assertion rendue différentielle (delta de +10 sur le compte de frais) |

## 5. Limites et points non couverts

- **Fournisseurs de paiement non branchés.** Aucune clé d'API n'est configurée, donc
  Flutterwave, CinetPay, PawaPay, MaxiCash, Stripe et PayPal fonctionnent en mode bac à
  sable : une page de paiement locale simule la confirmation du fournisseur via le
  webhook réel. Le circuit de l'argent en aval (registre, affectation, décaissement,
  justificatifs) est, lui, entièrement réel et testé. Le branchement réel attend la
  décision sur l'entité juridique (section 15, question 1).
- **Aucun test sur simulateur iOS ou Android.** L'application mobile a été vérifiée via
  Metro dans un navigateur à 375×812. Le code est natif (Expo SDK 57, React Native 0.82)
  et `expo start --ios` / `--android` sont prêts, mais aucun simulateur n'était disponible
  dans cet environnement.
- **Envoi d'e-mails non branché.** Les invitations renvoient le lien d'activation dans la
  réponse de l'API au lieu de l'envoyer par courriel ; les reçus PDF sont générés et
  téléchargeables mais pas expédiés.
- **Antivirus sur les fichiers non branché.** Les types et les tailles sont contrôlés,
  l'analyse antivirus mentionnée à la section 12 reste à ajouter.
- **Chiffrement applicatif des champs psychotrauma.** L'accès est strictement contrôlé et
  journalisé, mais les champs ne sont pas encore chiffrés séparément au repos.
- **Mode hors-ligne (V2).** Prévu pour les rôles de terrain, non implémenté.
- **Cartes interactives, Académie RISAC, Tremplin, Seed Fund.** Prévus en V2 et V3.
