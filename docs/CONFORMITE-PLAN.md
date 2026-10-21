# Conformité au plan fonctionnel — RISAC

Comparaison du `RISAC_Plan_Fonctionnel.pdf` (version 1.0, octobre 2026) avec le code,
section par section. Complète `VERIFICATION.md` et `AUDIT-2026-10-13.md`.

## Méthode et limites

Lecture intégrale du plan, puis vérification de chaque affirmation dans le schéma Prisma,
les services du backend, les écrans web et l'application mobile. Ce rapport porte sur
l'**existence et le branchement** du code. Il ne rejuge pas les parcours déjà testés dans
`VERIFICATION.md` (156 vérifications de bout en bout) et ne constitue pas un audit de
sécurité.

## Vue d'ensemble

| Section du plan | État |
| --- | --- |
| 1. Vision et objectif | Conforme |
| 2. Analyse critique (14 problèmes) | Conforme : les 14 solutions sont en place |
| 3. Acteurs et hiérarchie | Conforme |
| 4. Fiche orphelinat et labellisation | Conforme |
| 5. Dossier de l'enfant | Conforme |
| 6. Historique et mises à jour | Conforme sauf l'export PDF |
| 7. Circuits de validation | Conforme |
| 8. Espace de communication | Conforme |
| 9. Canaux de messagerie | Partiel : antivirus et accusés de lecture |
| 10. Paiement et circuit de l'argent | Conforme en logique, fournisseurs en bac à sable |
| 11. Tableaux de bord par acteur | Partiel : mobile incomplet, exports absents |
| 12. Sécurité et conformité | Partiel : quatre mesures absentes |
| 13. Architecture technique | Conforme |
| 14. Feuille de route | V1 faite, V2 partielle, V3 non commencée |
| 15. Décisions en attente | 5 décisions sur 6 tranchées en paramètres |

## Ce qui est conforme

**Acteurs (§3)** — Les 12 rôles existent avec exactement les noms du plan. L'invitation
porte le rôle, le pays et la province, avec lien d'activation à durée limitée, code à
usage unique par e-mail et renvoi. La remontée automatique quand un niveau est vacant est
implémentée (`approvals.service.ts`).

**Fiche orphelinat (§4)** — Toutes les rubriques sont présentes : logo, photos, vidéo,
statut juridique, numéro d'agrément, GPS avec masquage en zone à risque, places totales et
occupées, infrastructures (dortoir, eau potable, électricité, école, infirmerie), compte
bancaire et mobile money avec vérification, labellisation avec date d'expiration,
historique des visites et audits.

**Dossier enfant (§5)** — Modèle configurable par pays, les 11 statuts du plan à
l'identique, les deux niveaux de visibilité, tous les volets y compris FONAREV
(`fonarevStatus`, `fonarevFileNumber`), projet de vie, post-majorité
(`postMajorityPrepared`, `tremplinScholarship`, `mentorName`) et consentements.

**Historique (§6)** — Les 13 types d'événements du plan sont présents, plus deux ajouts.
Versions conservées et comparaison entre deux versions. Détection de doublons au moment
de la création.

**Circuits de validation (§7)** — Les statuts de projet correspondent. Le rappel à 72 h
puis la remontée au niveau supérieur sont implémentés dans `approvals.scheduler.ts`, avec
le délai configurable (`VALIDATION_ESCALATION_HOURS`).

**Argent (§10)** — Les quatre types de soutien, le circuit en 8 étapes avec séparation des
pouvoirs, le reçu PDF, le multi-devises, les frais annoncés avant paiement, le plafond du
projet avec redirection vers le fonds général, le remboursement et la réaffectation.
L'échec d'un prélèvement récurrent déclenche une nouvelle tentative à trois jours, puis une
mise en pause après trois échecs, avec notification — exactement le comportement décrit.
Le rapprochement quotidien tourne à 3 h du matin.

**Architecture (§13)** — Conforme au choix proposé : Expo et TypeScript, NestJS,
PostgreSQL avec Prisma, Socket.io, ISO 3166. Redis est présent dans `docker-compose.yml`.

## Ce qui est mal fait

Deux contrôles existent dans l'interface mais ne produisent aucun effet. Ils donnent
l'illusion d'une fonction disponible.

| Contrôle | Problème |
| --- | --- |
| **Mode maintenance** (`/parametres`) | Le réglage est enregistré en base, mais **aucun garde ne le lit**. Activer la maintenance ne bloque rien ni personne. |
| **Choix de la langue** (profil) | Les quatre langues sont proposées et `locale` est sauvegardé, mais **il n'existe aucun fichier de traduction**. L'interface reste en français quel que soit le choix. |

Le plan annonce quatre langues en V1 (§11, « commun à tous ») et le multilingue complet
en V2 (§14). Aujourd'hui le socle d'internationalisation n'est pas posé.

## Ce qui reste à faire

### Sécurité et conformité (§12)

| Mesure du plan | État |
| --- | --- |
| Analyse antivirus des fichiers | **Absente.** Types et tailles contrôlés, aucun scan. |
| Chiffrement séparé des champs psychotrauma et médicaux | **Absent.** L'accès est strictement contrôlé et journalisé, mais les champs sont en clair en base. |
| Sauvegardes quotidiennes | **Absentes.** Aucun script ni tâche planifiée. |
| Droit à l'oubli | **Absent.** Aucune suppression ni anonymisation de compte. |

Les autres mesures de la section 12 sont en place : permissions par périmètre, double
authentification obligatoire pour les administrateurs, journal d'audit non modifiable,
consentement photo bloquant, filtrage automatique des publications, détection de doublons,
séparation des pouvoirs, blocage après échecs de connexion.

### Messagerie (§9)

- **Accusés de lecture** : partiels. Le champ `readBy` n'enregistre que l'auteur à
  l'envoi ; la lecture par les autres membres met à jour `lastReadAt` du canal, pas le
  message. Le plan demande des accusés de lecture par message.
- **Antivirus sur les pièces jointes** : absent, voir ci-dessus.

Le temps réel, la recherche dans un canal, l'épinglage et l'accès de modération à tous les
canaux sont en place.

### Exports (§6 et §11)

Le plan demande plusieurs exports qui n'existent pas :

- **Export PDF du dossier et de l'historique** « pour un juge, le FONAREV ou un audit » (§6)
- **Exports comptables** pour l'Admin Finance (§11)
- **Rapports exportables** pour le gouvernement et le FONAREV, Responsable National (§11)

Seul le reçu de don en PDF existe (`receipts.service.ts`).

### Application mobile (§11)

Le plan est intitulé « plan fonctionnel de l'application mobile », et la section 13 réserve
le panneau d'administration au web. Mais plusieurs rôles de terrain restent sans écran
dédié sur mobile :

| Rôle | Tableau de bord mobile |
| --- | --- |
| Ambassadeur, Chef d'orphelinat, Bailleur, Partenaire | Présents |
| Agent de terrain | **Absent** — or le plan lui demande la saisie hors-ligne et le signalement d'urgence |
| Personnel de l'orphelinat (psychologue, éducateur, infirmier) | **Absent** |
| Chef Régional, Responsable National | **Absents** |

Douze écrans existent au total. Les projets, les décaissements et la fiche orphelinat n'ont
pas d'écran mobile.

### Mode hors-ligne (§11 et §13)

**Absent.** Le plan le prévoit pour les rôles de terrain en V1 (« commun à tous ») puis en
V2 (§14). Aucun stockage local ni synchronisation n'est implémenté.

### Carte interactive (§14, V2)

La carte mondiale des utilisateurs du tableau de bord Super Admin existe sous forme de
liste par pays. La carte interactive annoncée en V2 n'est pas faite.

### V3 — non commencée

Académie RISAC, programme Tremplin, mentorat, Seed Fund, rôle « jeune majeur ». Les champs
`tremplinScholarship` et `mentorName` existent dans le dossier enfant, mais aucun programme
ne les exploite.

### Fournisseurs de paiement (§10.2)

Flutterwave, CinetPay, PawaPay, MaxiCash, Stripe et PayPal fonctionnent en bac à sable :
une page de paiement locale simule la confirmation via le webhook réel. Le circuit en aval
est entièrement réel. Le branchement attend la décision 1 de la section 15.

## Décisions en attente (§15)

| # | Question | État |
| --- | --- | --- |
| 1 | Entité juridique qui reçoit l'argent | **Ouverte.** Bloque le branchement des fournisseurs de paiement. |
| 2 | Seuil de validation par le chef régional | Tranchée : paramètre, 1 000 $ par défaut |
| 3 | Plusieurs parrains ou parrain exclusif | Tranchée : paramètre, plusieurs parrains par défaut |
| 4 | Frais de fonctionnement | Tranchée : paramètre, 5 % par défaut |
| 5 | Sous-compte « Personnel de l'orphelinat » | Tranchée : rôle `ORPHANAGE_STAFF` en place |
| 6 | Validation finale du chef régional | Tranchée : paramètre, activée par défaut |

Les cinq décisions techniques sont donc modifiables depuis `/parametres` sans changement de
code. Seule la décision 1 reste à prendre par la Coordination.

## Corrections apportées après ce rapport

Première passe sur les écarts, le 14 octobre 2026.

| Écart | État | Vérification |
| --- | --- | --- |
| **Mode maintenance** sans effet | **Corrigé.** `MaintenanceGuard` global. | Testé : ambassadeur 503, Super Admin 200, pages publiques 200, accès rétabli à la levée. |
| **Sélecteur de langue** mensonger | **Corrigé.** Seul le français est sélectionnable ; les trois autres langues restent annoncées mais désactivées, avec une mention explicite. | L'interface ne promet plus ce qu'elle ne fait pas. |
| **Antivirus** absent | **Fait.** `AntivirusService` : ClamAV par `CLAMAV_HOST`, sinon contrôle des octets de signature. Un fichier refusé est effacé du disque. | Testé : PNG valide accepté, exécutable Windows déguisé en PNG refusé, faux PDF refusé. |
| **Sauvegardes quotidiennes** absentes | **Fait.** `BackupService`, `pg_dump` à 1 h, rétention configurable, `PG_DUMP_BIN` pour un PostgreSQL en conteneur. | Testé : dump de 347 Ko, 47 tables. |
| **Droit à l'oubli** absent | **Fait.** `DELETE /users/:id/personal-data` (Super Admin et Auditeur Éthique). Anonymisation et non suppression : les écritures comptables et le journal d'audit restent vérifiables. | Testé : compte anonymisé, sessions révoquées, appareils supprimés, seconde tentative refusée. |
| **Accusés de lecture** partiels | **Fait.** `markRead` inscrit le lecteur dans `readBy` de chaque message lu. | Compilé ; non exercé de bout en bout. |

Les variables ajoutées sont documentées dans `backend/.env.example` : `CLAMAV_HOST`,
`CLAMAV_PORT`, `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, `PG_DUMP_BIN`, `BACKUP_DATABASE_URL`.

### Restant après cette passe

Par ordre de poids : internationalisation réelle (4 langues sur 42 écrans), écrans mobiles
des rôles de terrain, exports PDF et comptables, chiffrement au repos des champs
psychotrauma, mode hors-ligne, carte interactive, puis la V3.

## Priorités suggérées

1. **Les deux contrôles non fonctionnels** — mode maintenance et choix de la langue. Soit
   on les implémente, soit on les retire de l'interface : en l'état ils trompent.
2. **Antivirus et chiffrement des champs psychotrauma** — ce sont des engagements de la
   section 12 sur une plateforme qui traite des données d'enfants vulnérables.
3. **Exports PDF** — le plan les justifie par des usages externes (juge, FONAREV, audit,
   bailleurs) difficilement contournables.
4. **Écrans mobiles des rôles de terrain** — l'agent de terrain est le seul rôle dont le
   plan décrit explicitement un usage mobile hors-ligne, et il n'a pas d'écran.
5. **Sauvegardes quotidiennes** — absence totale, sur une base qui contient déjà des
   dossiers réels.
