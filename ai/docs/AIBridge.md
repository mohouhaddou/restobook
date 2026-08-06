# AI Bridge

`AIBridge` est la façade applicative. Il expose création, exécution, pause, reprise, annulation, retry, santé et métriques. `BridgeFactory` constitue le graphe de dépendances et peut être remplacé par un composition root backend.

```mermaid
flowchart TD
  D[Dashboard] --> C[Create Job]
  C --> Q[Job Queue]
  Q --> B[AI Bridge]
  B --> PS[Provider Selector]
  PS --> ED[Editor Dispatcher]
  ED --> P[AI Provider]
  P --> CP[Content Package]
  CP --> W[Workflow Engine]
  W --> PUB[Publisher]
  PUB --> DB[(Database)]
  DB --> E[Dashboard Events]
```
