# Workflow — iFilino Discover

## Objectif

Préparer un contenu magazine généraliste pour iFilino Discover, sans le
publier ni l’adapter au modèle de données actuel.

## Entrées attendues

- brief éditorial ;
- langue et éventuelles langues cibles ;
- rubrique et type de contenu souhaités ;
- sources autorisées ou fournies ;
- contraintes de ton, longueur et calendrier.

## Étapes prévues

1. **Cadrage** — interpréter le brief et identifier l’angle.
2. **Plan** — proposer une structure cohérente et les informations à couvrir.
3. **Rédaction** — préparer titre, résumé et corps Markdown.
4. **Médias** — décrire les images nécessaires via `ImageAsset`.
5. **Métadonnées** — compléter classement, tags et propositions SEO.
6. **Contrôle éditorial** — vérifier cohérence, sources, clarté et complétude.
7. **Revue humaine** — soumettre le paquet avant toute future publication.

## Sortie attendue

Un `EditorResult` contenant un `ContentPackage` avec le canal `discover`, ou
un résultat `review_required`/`failed` documenté.

## Hors périmètre actuel

Génération IA, recherche en ligne, upload d’image, traduction, publication,
appel API et accès à la base de données.
