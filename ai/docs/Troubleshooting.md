# Troubleshooting

## Bootstrap INVALID

Lire `checks`, restaurer les fichiers absents et valider le profil JSON.

## Job FAILED

Consulter `JobHistory`, les résultats d'étapes et `errorCode`. Une erreur fatale
ne doit pas être relancée ; une erreur récupérable suit `RetryPolicy`.

## Health check dégradé

Identifier la probe en échec avant tout démarrage. Les probes isolent les
exceptions et retournent `false`.

## Transaction rollback

Vérifier le port `AiPublisherDatabaseTransaction`. Aucun service ne doit écrire
hors repository.

## Dépendance circulaire

Déplacer le contrat partagé vers `types/` ou un port de niveau inférieur.
