# Système de design RISAC

Source de vérité : `frontend/tailwind.config.js` (jetons) et `frontend/src/app/globals.css`
(composants). Le mobile reprend les mêmes valeurs dans `mobile/src/theme/index.ts`.

## Marque

Logo officiel fourni par Congo Meilleur, fond rendu transparent pour se poser sur toute surface
claire.

| Fichier | Usage |
| --- | --- |
| `frontend/public/brand/risac-logo.png`, `mobile/assets/risac-logo.png` | Logo complet (toit, emblème, mot RISAC) |
| `frontend/public/brand/risac-emblem.png`, `mobile/assets/risac-emblem.png` | Emblème seul, espaces étroits |
| `frontend/src/app/icon.png`, `apple-icon.png` | Favicon et icône d'écran d'accueil |
| `mobile/assets/icon.png`, `adaptive-icon.png`, `splash.png` | Icône, icône adaptative Android, écran de démarrage |

Le logo a un contour noir et un bleu marine : il ne se pose jamais sur un fond sombre.

## Couleurs

Mesurées sur le logo : bleu marine du mot RISAC `#123F62`, vert `#347B4A`, jaune `#E7B92C`,
rouge `#A73F33`, bleu acier `#467C92`. Le bleu porte l'identité, les couleurs d'état gardent leur sens.

| Jeton | Rôle | Valeur clé |
| --- | --- | --- |
| `risac` | Marque et actions. 700 = action principale, 800 = bleu du logo | `#174A70`, `#123F62` |
| `ink` | Neutres gris-bleu. 400 et au-delà : 4,5:1 minimum sur blanc | `#5F7185` … `#263746` |
| `success` (alias `emerald`) | Validé, financé, conforme | `#23965A` |
| `warning` (alias `amber`) | Attention, à corriger, sous conditions | `#E6AD28` (texte `#8A5D0A`) |
| `danger` (alias `rose`) | Refusé, bloqué, destructif | `#C2453D` |
| `confidential` (alias `violet`) | Données confidentielles | `#5C4F9C` |
| `steel` (alias `teal`) | Information neutre, données | `#2D8C8C` |

Les anciens noms (`emerald`, `rose`, `amber`, `violet`) sont conservés comme alias pour que le code
existant reste valide. Aucune couleur n'est écrite en dur dans les composants.

## Typographie

IBM Plex Sans (interface) et IBM Plex Mono (références, codes). Chiffres tabulaires pour les montants.

| Classe | Usage |
| --- | --- |
| `page-title` | Titre de page (24 px, 600) |
| `section-title` | Titre de section (16 px, 600) |
| `card-title` | Titre de carte (14 px, 600) |
| `table-head` | En-tête de tableau (12 px, 600) |
| `meta`, `page-subtitle` | Métadonnées, sous-titres |

Pas de majuscules forcées, pas de texte sous 12 px hors pastilles de comptage.

## Composants

- **Boutons** : `btn-primary`, `btn-soft`, `btn-outline`, `btn-ghost`, `btn-danger`, `btn-icon`.
  44 px de haut sur mobile, 40 px au-dessus. États survol, appui, focus, désactivé. Pour un
  chargement : `aria-busy="true"` sur le bouton. Un bouton-icône exige un `aria-label`.
- **Champs** : `input` et `label`. `aria-invalid="true"` colore le champ en erreur.
- **Pastilles** : `chip` accompagné d'un texte, jamais d'une couleur seule.
- **Navigation** : `nav-item` et `nav-item-active` (bleu marine plein).
- **Surfaces** : `card`, `card-pad`, `brand-band` (réservé aux zones d'accueil).

## Mouvement

Transitions de 120 à 260 ms (`duration-fast`, `base`, `slow`), courbe `ease-standard`.
Animations : `fade-up`, `fade-in`, `scale-in`, `slide-in-left`. Aucune bibliothèque d'animation.
`prefers-reduced-motion` coupe toutes les animations et transitions.

## Accessibilité

Focus visible sur tous les contrôles (contour 2 px bleu). Repères `main` et `aside` sur les pages de
connexion. Ordre des titres respecté. Zones tactiles de 44 px sur mobile.
