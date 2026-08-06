# AI Publishing Backend

Deux contrats coexistent sans dépendance circulaire : le contrat historique `AiPublisher*` et le nouveau pipeline autonome `PublishService` basé sur un `ImportJob` validé.

Le pipeline couvre détection de doublons (slug, titre, contenu), slug, catégorie, tags, import WebP sans écrasement, réécriture Markdown, SEO, statistiques éditoriales, insertion atomique, historique et événements WebSocket.

Documentation : `docs/PUBLISHER.md`, `IMAGES.md`, `MARKDOWN.md`, `SEO.md`, `TRANSACTIONS.md`.
