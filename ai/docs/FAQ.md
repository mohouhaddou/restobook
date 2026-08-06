# FAQ

## Comment brancher un futur modèle IA ?

Créer un adapter fournisseur qui produit un `ContentPackage`, puis le déposer
dans le workspace. Le modèle ne doit pas connaître le Publisher ou la base.

## Comment ajouter un éditeur ?

Étendre le contrat, fournir workflow, adapter, importer, exemples et tests, puis
enregistrer ces éléments dans la composition.

## Les démonstrations publient-elles ?

Non. Elles utilisent des contenus fictifs et retournent des rapports simulés.

## Où ajouter un nouveau Publisher ?

Dans un module séparé implémentant le port attendu par l'orchestrateur.

## Peut-on activer Slack ou Email ?

Les hooks existent comme contrats. Une implémentation sécurisée et injectée est
nécessaire avant activation d'un feature flag.
