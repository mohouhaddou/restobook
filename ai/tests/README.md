# Tests de l'infrastructure IA

Les tests restent structurels, techniques et sans effet externe.

## Contrats

- `content-package.test.ts` valide les exemples et JSON Schema.

## Workflow Engine

- `workflow-registry.test.ts` couvre le registre.
- `workflow-validator.test.ts` couvre structure, ordre et types.
- `workflow-engine.test.ts` couvre séquençage, événements, rapports et arrêt.

## Publisher Engine

- `publisher-validator.test.ts` couvre paquet, images, Markdown, métadonnées et SEO.
- `publisher-pipeline.test.ts` couvre ordre, warnings, phases désactivées et arrêt.
- `publisher-engine.test.ts` couvre validation, handlers, événements et rapport.

## Content Package Manager

- `content-manager.test.ts` couvre le cycle de vie complet en mémoire.
- `content-version.test.ts` couvre le versionnage et la comparaison.
- `content-validator.test.ts` couvre la validation structurelle.
- `content-history.test.ts` couvre la conservation des snapshots.
- `content-statistics.test.ts` couvre les métriques techniques.

## FileSystem Connector

- `filesystem.test.ts` couvre le dépôt et la récupération.
- `workspace.test.ts` couvre le cycle de vie des workspaces.
- `scanner.test.ts` couvre les quatre files scannées.
- `resolver.test.ts` couvre confinement et portabilité des chemins.
- `validator.test.ts` couvre la convention des fichiers obligatoires.

## Couche Integration

- `integration-engine.test.ts` couvre registre, validation, préparation et rollback.
- `adapter.test.ts` vérifie le contrat commun des cinq adapters.
- `importer.test.ts` couvre Markdown, images, métadonnées et package préparé.
- `resolver.test.ts` couvre langue, catégorie, tags, liens, SEO et assets.
- `slug.test.ts` couvre les slugs français, anglais et arabes.

## AI Orchestrator

- `orchestrator.test.ts` couvre pipeline, contrôles et retries automatiques.
- `scheduler.test.ts` couvre planification et annulation.
- `queue.test.ts` couvre FIFO et index des jobs.
- `retry.test.ts` couvre backoff et classification des erreurs.
- `metrics.test.ts` couvre durées, taux, publications et retries.
- `health.test.ts` couvre les sept composants.
- `jobs.test.ts` couvre la fabrique et les jobs communs.

## Backend AI Publisher

Les tests du module backend se trouvent dans
`backend/src/modules/ai-publisher/tests/`. Ils couvrent le service, le
repository, les validations, les cinq importers, le rollback et les
transactions atomiques avec un port de base de données en mémoire.

Les fichiers temporaires des tests sont isolés dans le répertoire temporaire du
système puis supprimés. Aucun test n'accède au disque applicatif, à une API, à
une base de données ou à un produit iFilino.
