# Moteur de workflows

Ce module orchestre des workflows déclaratifs sans connaître leur domaine,
leur éditeur ou la logique exécutée par leurs étapes.

## Responsabilités

- enregistrer et charger des définitions avec `WorkflowRegistry` ;
- vérifier leur structure avec `WorkflowValidator` ;
- associer un type d’étape à un handler injecté ;
- exécuter les étapes séquentiellement avec `WorkflowExecutor` ;
- arrêter les actions après le premier résultat `ERROR` ;
- journaliser début, fin, durée, avertissements et erreurs ;
- retourner un `WorkflowExecutionReport` complet ;
- exposer les événements de cycle sans dépendance externe.

## Non-responsabilités

Le moteur ne génère aucun texte ou média, ne manipule aucun article, ne publie
rien, n’appelle aucune API et n’accède à aucune base de données. Les noms
`ValidateInput`, `GenerateImages` ou `Finalize` sont seulement des types
déclaratifs associés ultérieurement à des handlers externes.

## Composants

- `WorkflowEngine.ts` : façade du registre, du validateur et de l’exécuteur.
- `WorkflowRegistry.ts` : stockage en mémoire des définitions.
- `WorkflowExecutor.ts` : exécution séquentielle et arrêt sur erreur.
- `WorkflowContext.ts` : état générique partagé pendant une exécution.
- `WorkflowValidator.ts` : validation de structure, d’ordre et de types.
- `WorkflowLogger.ts` : journal structuré conservé dans le contexte.
- `WorkflowErrors.ts` : erreurs techniques explicites.
- `WorkflowEvents.ts` : définitions, résultats, rapports et bus d’événements.
- `index.ts` : point d’entrée public du module.

## Exemple d’intégration abstraite

```ts
import {
  WorkflowEngine,
  createWorkflowContext,
  type WorkflowDefinition,
} from './workflow-engine';

const definition: WorkflowDefinition = {
  id: 'example',
  name: 'Example',
  version: '1.0.0',
  steps: [
    { id: 'validate', name: 'Validate', type: 'ValidateInput', order: 1 },
  ],
};

const engine = new WorkflowEngine();
engine.registerStepHandler('ValidateInput', async () => ({
  status: 'SUCCESS',
}));
engine.register(definition);

const context = createWorkflowContext({
  editor: 'opaque-editor',
  workingDirectory: 'workspace/example',
  metadata: {},
});

const report = await engine.execute('example', context);
```

L’exemple montre uniquement le contrat d’orchestration. Le handler ne contient
aucune action métier.
