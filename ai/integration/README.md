# Couche d'intégration iFilino

Cette couche transforme un `ContentPackage` en artefact d'intégration portable.
Elle ne publie rien et ne connaît ni route, contrôleur, base de données, API ou
composant frontend.

## Pipeline

1. `IntegrationValidator` vérifie la compatibilité package/adapter.
2. `ContentImporter` coordonne Markdown, images et métadonnées.
3. Les resolvers normalisent slug, langue, catégorie, tags, liens, SEO et chemins.
4. L'adapter produit un `IntegrationArtifact` purement descriptif.
5. `IntegrationEngine` conserve un reçu en mémoire que `rollback()` peut annuler.

Les destinations d'assets (`uploads/discover`, `uploads/sports`, `uploads/kids`,
`uploads/stories`, `uploads/gaming`) sont uniquement des chemins futurs. Aucun
fichier n'est copié.

## Adapters

Tous les adapters implémentent `IntegrationAdapter` et héritent de `BaseAdapter`.
Ils déclarent uniquement un identifiant et un produit cible. Toute future
connexion technique devra être injectée dans une étape ultérieure, hors de ce
module.
