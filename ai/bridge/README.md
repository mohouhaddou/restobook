# AI Bridge

Couche anti-corruption entre le Dashboard et les moteurs IA. Le Dashboard crée et commande des `Job`; le Bridge sélectionne un provider, distribue vers un éditeur, prépare un `ContentPackage`, appelle les ports Workflow/Publisher injectés et publie des événements.

Le mode par défaut utilise `MockProvider`. Aucun SDK fournisseur n'est importé par le Dashboard.
