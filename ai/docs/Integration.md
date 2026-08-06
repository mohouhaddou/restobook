# Integration

La couche d'intégration normalise Markdown, assets, métadonnées, catégories,
tags, langues, liens et SEO. Elle produit un artefact descriptif, sans publier.

Pour créer un adapter :

1. implémenter `IntegrationAdapter` ou étendre `BaseAdapter` ;
2. déclarer `id` et `targetProduct` ;
3. conserver `prepare()` sans effet externe ;
4. enregistrer l'adapter dans `IntegrationEngine`.

Pour ajouter une catégorie, étendre la configuration éditoriale ou le resolver,
sans introduire de condition dans les moteurs génériques.
