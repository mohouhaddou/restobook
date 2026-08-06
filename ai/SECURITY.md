# Sécurité

Signaler les vulnérabilités par un canal privé, sans ouvrir de ticket public
contenant des détails exploitables. Ne jamais inclure de secret ou donnée réelle
dans un rapport.

Les points d'entrée doivent valider `ContentPackage`, confiner les chemins,
limiter les retries, vérifier les feature flags et utiliser des transactions.
Les webhooks futurs devront être signés, les secrets externalisés et les logs
expurgés. Toute publication réelle exige authentification, autorisation et
traçabilité.
