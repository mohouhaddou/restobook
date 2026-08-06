# iFilino AI Command Center

Cockpit React isolé disponible sur `/dashboard/ai`. Il fournit 22 vues de pilotage pour la rédaction IA, sans connexion à une API ni mutation du backend.

## Architecture

- `AICommandCenter.tsx` : shell, navigation interne, thème, langue, recherche et routage.
- `pages/Pages.tsx` : les 22 vues métier demandées.
- `components/` : cartes, visualisations, Kanban, calendrier, états et assistant de création.
- `data/mockData.ts` : jeu de données réaliste et déterministe.
- `services/mockAIService.ts` : promesses simulées et stockage mémoire. Aucun appel réseau.
- `i18n.tsx` : socle local FR/EN/AR et bascule RTL.
- `types.ts` : contrats TypeScript stricts.

## Points d’intégration futurs

1. Remplacer `mockAIService` par un adapter implémentant les mêmes signatures.
2. Brancher les événements temps réel via le client Socket.IO déjà présent.
3. Alimenter Jobs, Publications, Providers et Health depuis les endpoints dédiés.
4. Connecter `NewJobWizard` à l’orchestrateur IA.
5. Persister thème, langue et préférences par utilisateur.
6. Remplacer les placeholders Images/Vidéos par les assets signés.

## Vérification

```bash
npm run typecheck:ai
npm run build
```

La route est chargée paresseusement dans `App.jsx` et protégée par `PLATFORM_MANAGE`.
