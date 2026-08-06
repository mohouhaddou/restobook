# Contrats TypeScript

Ce dossier définit le modèle commun échangé entre les futures rédactions IA
et le Publisher. Les contrats sont fortement typés, sérialisables et
indépendants des modèles de données des produits iFilino.

## Interfaces

- `ContentPackage` représente l’article complet : contenu Markdown, sections,
  métadonnées, images, SEO, workflow, version et statut.
- `Metadata` décrit le titre, le slug, le résumé, l’auteur, la classification,
  le temps de lecture, la difficulté, les sources et la licence.
- `EditorResult` décrit le résultat terminal et les diagnostics d’une
  rédaction, sans exécuter cette rédaction.
- `ImageAsset` décrit un fichier image portable et son rôle éditorial.
- `PublisherJob` décrit l’enveloppe minimale d’un futur travail de
  publication.
- `Workflow` et `WorkflowStep` décrivent la séquence déclarative suivie par un
  éditeur.
- `ArticleSection` représente une section structurée du corps Markdown et son
  éventuelle référence d’image.
- `SeoMetadata`, `OpenGraphMetadata` et `TwitterMetadata` regroupent les
  informations SEO et sociales.
- `index.ts` expose tous les types depuis un point d’entrée unique.

## Conventions

- Les propriétés transportées sont `readonly`.
- Les listes utilisent `readonly T[]`.
- Les états, langues, éditeurs, formats et rôles sont des unions littérales.
- Les dates sont des chaînes ISO 8601 dans les interfaces et sont annotées
  `date-time` dans les schémas JSON.
- Les interfaces ne contiennent aucune méthode ni logique métier.

Les représentations sérialisées correspondantes sont définies dans
`../schema/`.
