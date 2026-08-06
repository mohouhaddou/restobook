# Workflow

Un workflow est une définition ordonnée d'étapes. `WorkflowEngine` enregistre,
valide puis délègue chaque étape à un handler injecté. Il s'arrête à la première
erreur et produit un rapport.

Pour créer un workflow :

1. ajouter une définition JSON dans `workflows/` ;
2. utiliser des ordres continus et des identifiants uniques ;
3. enregistrer des handlers compatibles au démarrage ;
4. ajouter le pipeline correspondant dans `OrchestratorPipeline` par
   configuration ou via `registerWorkflow()`.

Les workflows ne doivent contenir ni accès base, ni publication, ni logique
spécifique à un écran.
