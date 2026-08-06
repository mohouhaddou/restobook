# Deployment

1. installer les dépendances dans `/ai` ;
2. sélectionner `development`, `production` ou `test` ;
3. exécuter la compilation TypeScript ;
4. lancer la validation globale ;
5. vérifier le health check ;
6. brancher explicitement les ports réels dans une racine de composition ;
7. démarrer les workers seulement après validation `READY`.

Les secrets ne doivent jamais être placés dans les JSON de configuration. Les
adapters de base de données et de notifications doivent utiliser le système de
secrets du déploiement. Un rollback de déploiement ne doit pas supprimer les
ContentPackages archivés.
