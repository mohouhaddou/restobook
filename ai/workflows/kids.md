# Workflow — iFilino Kids

## Objectif

Préparer un contenu sûr, compréhensible et adapté au jeune public pour
iFilino Kids.

## Entrées attendues

- brief pédagogique ou ludique ;
- tranche d’âge cible ;
- objectif d’apprentissage ou de divertissement ;
- langue et longueur ;
- sources et contraintes de sécurité.

## Étapes prévues

1. **Cadrage par âge** — déterminer vocabulaire, complexité et format.
2. **Objectif pédagogique** — expliciter ce que l’enfant doit comprendre ou
   réaliser.
3. **Plan** — construire une progression courte et claire.
4. **Rédaction** — produire le contenu Markdown sans collecte de donnée
   personnelle ni incitation dangereuse.
5. **Médias** — décrire des visuels adaptés et leur texte alternatif.
6. **Contrôle de sécurité** — vérifier âge, ton, inclusivité et absence de
   contenu inapproprié.
7. **Revue humaine obligatoire** — aucun paquet Kids ne doit poursuivre son
   cycle sans validation.

## Sortie attendue

Un `EditorResult` contenant un `ContentPackage` avec le canal `kids` et les
informations d’âge dans `extensions`.

## Hors périmètre actuel

Génération, profilage d’enfant, personnalisation, publication, API et base de
données.
