# Publisher

`PublisherEngine` transforme un package validé en artefact publiable au travers
des phases Validate, Normalize, PrepareImages, PrepareMarkdown,
PrepareMetadata, Package et Finalize.

Le moteur ne persiste rien. La persistance atomique appartient au module backend
`ai-publisher`, via son repository. Pour ajouter un publisher, implémenter les
handlers des phases, déclarer leur configuration et injecter le moteur dans le
port orchestrateur. Ne jamais importer un modèle de données dans le service.
