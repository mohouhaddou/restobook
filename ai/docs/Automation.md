# Automation

`AIOrchestrator` coordonne les ports FileSystem, Content Manager, Workflow,
Publisher, Integration, backend et archive. Sa file utilise les états PENDING,
VALIDATING, IMPORTING, PUBLISHING, ARCHIVING, SUCCESS, FAILED, RETRYING et
CANCELLED.

Les retries sont limités et utilisent un backoff exponentiel. Le scheduler ne
démarre aucun job sans appel explicite. Les métriques et historiques sont en
mémoire et peuvent être remplacés par des adapters persistants. Les hooks
notifications, webhooks, Slack, Discord et Email sont volontairement inactifs.
