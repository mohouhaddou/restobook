# Workflow — Publication

## Objectif

Décrire le futur passage d’un `ContentPackage` validé à un résultat de
publication, sans implémenter cette opération.

## Préconditions

- le paquet respecte la version de schéma attendue ;
- le canal cible est connu ;
- la revue humaine requise est enregistrée ;
- les médias et sources obligatoires sont décrits ;
- le publisher est explicitement activé par configuration.

## Cycle théorique

1. **Incoming** — recevoir un `PublisherJob` immuable.
2. **Validation structurelle** — contrôler le contrat et les champs requis.
3. **Processing** — réserver le travail pour éviter un double traitement.
4. **Adaptation future** — convertir le paquet vers le format du canal cible.
5. **Publication future** — appeler le connecteur du produit concerné.
6. **Published** — archiver le résultat et les identifiants retournés.
7. **Failed** — conserver l’erreur et les éléments nécessaires à la reprise.

## Garanties attendues pour une phase future

- idempotence ;
- traçabilité par `correlationId` ;
- conservation du paquet source ;
- validation humaine configurable ;
- erreurs explicites ;
- absence de secret dans les logs.

## Hors périmètre actuel

Worker, connecteur, authentification, appel API, écriture en base, import
Discover/Sports/Kids/Stories/GamingHub et reprise automatique.
