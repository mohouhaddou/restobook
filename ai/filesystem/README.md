# FileSystem Connector

Ce module définit la convention uniforme utilisée par les éditeurs IA pour
déposer et récupérer des `ContentPackage`. Il ne dépend d'aucun produit iFilino,
d'aucune API, base de données ou logique de publication.

## Convention d'un package

Chaque package est un dossier placé dans `incoming`, `processing`, `published`
ou `failed` :

```text
<package-id>/
├── article.md
├── metadata.json
└── images/
    └── cover.webp
```

`metadata.json` contient le `ContentPackage` sans `articleMarkdown`, dont la
valeur est portée par `article.md`. Les autres images déclarées peuvent être
placées à côté de `cover.webp`.

## Composants

- `FileSystemConnector` fournit la façade de lecture, dépôt et scan.
- `WorkspaceManager` crée la structure racine et gère les espaces temporaires.
- `DirectoryManager` encapsule les opérations génériques sur les dossiers.
- `PackageLocator` construit les emplacements canoniques.
- `PackageScanner` parcourt automatiquement les quatre files de packages.
- `PackageWatcher` est uniquement un contrat pour une future surveillance.
- `PathResolver` confine et normalise les chemins de manière portable.
- `FileValidator` contrôle les quatre éléments obligatoires et les chemins.
- `FileLogger`, `FileEvents` et `FileErrors` fournissent l'observabilité.

Le watcher n'a volontairement aucune implémentation active et ne démarre jamais
automatiquement.
