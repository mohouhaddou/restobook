# Dashboard Integration

Le frontend ou le contrôleur backend ne doit utiliser que :

- `DashboardJobService` pour créer, lire, annuler et relancer;
- `DashboardQueueService` pour la file et les priorités;
- `DashboardProgressService` pour les événements;
- `DashboardHistoryService` pour l'historique;
- `DashboardNotificationService` pour adapter un émetteur Socket.IO/WebSocket.

Points backend futurs : instancier le Bridge au démarrage, injecter les vrais ports Workflow/Publisher, enregistrer les providers configurés, appeler `initialize()`, puis relier un `WebSocketEmitter`.
