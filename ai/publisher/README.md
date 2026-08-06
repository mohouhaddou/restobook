# Publisher Engine

Le Publisher Engine transforme, par orchestration de phases injectées, un
`ContentPackage` validé en un résultat publiable opaque.

Il est totalement indépendant des produits iFilino. Il ne publie rien, ne
copie aucun fichier, n’accède pas au disque, à une API ou à une base de
données.

## Pipeline

Les phases canoniques sont :

1. `Validate`
2. `Normalize`
3. `PrepareImages`
4. `PrepareMarkdown`
5. `PrepareMetadata`
6. `Package`
7. `Finalize`

Ces noms décrivent uniquement des points d’orchestration. Le moteur ne réalise
aucune de ces actions. Chaque phase reçoit un handler indépendant injecté par
l’appelant et retourne `SUCCESS`, `WARNING`, `ERROR` ou `SKIPPED`.

## Composants

- `PublisherEngine.ts` : façade de validation et d’exécution.
- `PublisherPipeline.ts` : séquençage des phases et arrêt configurable.
- `PublisherContext.ts` : paquet, espace logique, configuration, temps, logs
  et résultat en mémoire.
- `PublisherValidator.ts` : contrôles structurels génériques.
- `PublisherLogger.ts` : journal en mémoire des débuts, fins, durées et
  diagnostics.
- `PublisherEvents.ts` : résultats, handlers et bus d’événements.
- `PublisherErrors.ts` : erreurs techniques structurées.
- `PublisherReport.ts` : rapports de phase et rapport complet.
- `PublisherConfiguration.ts` : phases et configuration canonique.
- `index.ts` : point d’entrée public.

## Garanties

- aucune dépendance au backend ;
- aucune connaissance de Discover, Sports, Kids ou GamingHub ;
- aucune logique métier spécifique ;
- aucune mutation du `ContentPackage` par le moteur ;
- arrêt après erreur lorsque `stopOnError` est activé ;
- rapport comprenant durée, erreurs, warnings, phases exécutées, phases
  ignorées, résultat et journal ;
- aucun effet externe dans le cœur du module.
