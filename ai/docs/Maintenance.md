# Maintenance

À chaque changement :

- compiler en TypeScript strict ;
- exécuter toute la suite de tests ;
- lancer `BootstrapValidator` ;
- contrôler les dépendances circulaires ;
- mettre à jour schémas, exemples, documentation et changelog ;
- vérifier les métriques de succès, durée et retries.

Les files temporaires peuvent être nettoyées avec `cleanup-ai.ts`. Ne jamais
supprimer automatiquement `incoming`, `failed` ou `archive`. Les changements de
contrat doivent rester rétrocompatibles ou augmenter explicitement la version.
