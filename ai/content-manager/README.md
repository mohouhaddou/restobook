# Content Package Manager

Ce module constitue la façade centrale de gestion des `ContentPackage`. Il est
générique, indépendant des produits iFilino et ne réalise aucun accès disque,
réseau, base de données ou publication.

## Composants

- `ContentManager` coordonne toutes les opérations publiques.
- `ContentLoader` et `ContentSaver` lisent et enregistrent des snapshots en mémoire.
- `ContentValidator` vérifie la structure commune du package.
- `ContentNormalizer` uniformise Markdown, SEO, tags, slug, langue, catégorie et sections.
- `ContentVersionManager` crée les versions séquentielles `v1`, `v2`, etc.
- `ContentComparer` compare les sections, le SEO, les images et les métadonnées.
- `ContentArchiver` gère les transitions entre contenus actifs et archivés.
- `ContentHistory` expose les snapshots historiques en lecture seule.
- `ContentStatistics` calcule des métriques techniques déterministes.
- `ContentLogger` et `ContentEvents` rendent les opérations observables en mémoire.
- `ContentErrors` fournit des erreurs typées avec des codes stables.

## Cycle de vie

`create()` normalise et valide le package, l'enregistre en mémoire puis crée `v1`.
Chaque appel à `save()` répète ces contrôles et crée la version suivante. Les
versions sont des snapshots indépendants et restent consultables même après
archivage ou suppression du contenu courant.

`archive()` et `restore()` changent uniquement la collection en mémoire dans
laquelle se trouve le snapshot courant. `duplicate()` crée un nouvel historique.
`compare()`, `history()` et `statistics()` sont des opérations de lecture.

Le stockage est volontairement injecté et éphémère : une future adaptation pourra
implémenter une persistance sans changer le contrat public du gestionnaire.
