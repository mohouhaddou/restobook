# Audit visuel iFilino Play — vague 1

## Synthèse priorisée

1. **P0 — cohérence et mobile** : shell commun, cibles tactiles ≥44 px, HUD compact, focus visible, safe areas, absence de débordement à 320 px.
2. **P0 — lisibilité/accessibilité** : signaux non fondés uniquement sur la couleur, états annoncés, contraste, clavier et RTL de l’interface sans inverser la logique des jeux.
3. **P1 — identité visuelle** : illustrations SVG originales, palette iFilino, profondeur modérée, écrans d’introduction et de résultat cohérents.
4. **P1 — composants mutualisés** : boutons, badges/HUD, artwork, résultat et conteneur responsive.
5. **P2 — vagues suivantes** : moderniser les jeux Phaser et historiques par lots de trois maximum, puis les cartes du hub.

## Audit par jeu

| Jeu | Composants / assets actuels | Problèmes observés | Priorité / proposition |
|---|---|---|---|
| Memory Cards | `MemoryCardsGame`, CSS Phase A, symboles texte | Cartes génériques, face cachée peu distinctive, densité forte en mode difficile | **Vague 1 réalisée** : glyphes SVG originaux, vraie face recto/verso, HUD et introduction premium |
| Reaction Test | `ReactionTestGame`, zone CSS unie | État essentiellement communiqué par couleur, composition très vide, résultat visuel faible | **Vague 1 réalisée** : cible, anneaux, éclair, badges, feedback textuel conservé |
| Color Match | `ColorMatchGame`, pastilles CSS | Signal trop dépendant de la couleur, prompt générique, boutons sans hiérarchie | **Vague 1 réalisée** : couleurs + formes, feedback iconographique, artwork et HUD |
| Bubble Pop | Phaser, formes Canvas sans assets | Bulles plates, HUD dessiné non mutualisé, particules limitées | **Vague 2 réalisée** : relief, reflets, trajectoire pointillée et particules légères |
| Brick Smash | Phaser, formes Canvas | Briques plates, peu de profondeur, bonus peu explicite | **Vague 2 réalisée** : volume subtil, traînée, bonus lisible, particules et fond arcade |
| Tower Stack | Phaser, rectangles Canvas | Décor minimal, alignement parfait peu valorisé | **Vague 2 réalisée** : skyline, profondeur, ombres et feedback d’alignement parfait |
| Penalty Master | Phaser, formes Canvas | Terrain et ballon très abstraits, zones tactiles peu matérialisées | **Vague 3 réalisée** : terrain, cage, ballon original, public abstrait et zones visibles |
| Snake | Phaser, grille et formes Canvas | Lisible mais très utilitaire, commandes basses serrées en petite hauteur | **Vague 3 réalisée** : serpent stylisé, nourriture illustrée, feedback et commandes premium |
| 2048 | `Game2048`, CSS grille | Tuiles génériques, progression et mouvements peu expressifs | **Vague 3 réalisée** : gamme de tuiles, HUD commun et pavé tactile accessible |
| Memory historique | `MemoryGame`, CSS historique | Incohérent avec Memory Cards, icônes et états anciens | **Vague 4** : aligner ou déprécier visuellement sans supprimer la route |
| Puzzle Image | `PuzzleImageGame`, image distante/jeu grille | Sélection peu visible, chargement et erreur image faibles | **Vague 4** : artwork/skeleton, sélection accessible, résultat commun |
| Quiz / True-False | `QuizEngine`, réponses CSS | Cartes proches d’un formulaire, feedback visuel modeste | **Vague 4** : cartes de réponse, progression et explication premium |
| Geo Quiz | `GeoQuizGame`, moteur quiz | Même dette visuelle que Quiz, contexte géographique peu illustré | **Vague 5** : illustration géographique originale et progression |
| Guess the Place | `GuessThePlaceGame`, carte/image | Hauteur carte fixe et risque de débordement mobile, chargement image | **Vague 5** : conteneur adaptatif, skeleton, commandes au pouce |

## Socle créé

- `ResponsiveGameContainer`
- `GameHUD`, `HUDBadge`, `ScoreBadge`, `TimerBadge`
- `PlayButton`
- `GameResultCard`
- `GameArtwork`
- `GameIntroScreen` commun aux jeux locaux et historiques
- système `PlayIcons` basé uniquement sur Lucide React et glyphes SVG originaux

Les composants suivants restent planifiés quand un jeu en aura réellement besoin : `LivesBadge`, `ProgressBar`, `DifficultyBadge`, `GameModal`, `GameInstructionCard`, états empty/error spécialisés et conteneur Phaser avec `ResizeObserver`.

## Vérifications de la vague 1

- Breakpoints CSS couverts : 320/340, 360–430, tablette et desktop via conteneur fluide et container queries.
- Cibles principales : 44 px minimum, boutons de jeu 48 px minimum.
- RTL : direction héritée du shell ; aucune direction RTL forcée dans une zone de jeu.
- Mouvement réduit : transitions et animations décoratives désactivées.
- SVG : 1,0–1,5 Ko chacun, très inférieurs au budget de 20 Ko.
- Aucun changement de route, API, score ou règle de jeu.
