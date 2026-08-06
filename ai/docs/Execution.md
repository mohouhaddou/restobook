# Execution

`JobExecutor` orchestre seulement. La génération appartient au provider; le prompt appartient à l'éditeur; le workflow et la publication sont des ports injectés.

En mode Mock, toutes les phases sont traversées et un `ContentPackage` contractuellement complet est produit. Les erreurs récupérables passent par `JobRetryPolicy` avec backoff exponentiel borné.
