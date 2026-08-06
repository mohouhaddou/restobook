# AI Publisher

Le Publisher reçoit exclusivement un `ImportJob` déjà validé. Il est indépendant du Dashboard et peut être appelé par AI Import, un workflow, un scheduler ou une API.

```mermaid
flowchart TD
  A[ImportJob validé] --> B[Publisher]
  B --> C[Détection doublon]
  C --> D[Images]
  D --> E[Markdown]
  E --> F[SEO]
  F --> G[(Transaction BDD)]
  G --> H[Publication]
  H --> I[PUBLISH_COMPLETED]
```

Modules pris en charge : `discover`, `sports`, `kids`, `stories`, `gaming`, `marketplace`.
