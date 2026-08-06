# API

- `POST /api/superadmin/ai-import` — upload du champ multipart `package`.
- `GET /api/superadmin/ai-import` — état des imports de l'instance.
- `GET /api/superadmin/ai-import/history` — 500 dernières entrées.
- `DELETE /api/superadmin/ai-import/history` — purge de l'historique.
- `GET /api/superadmin/ai-import/:id/report` — rapport texte téléchargeable.

Toutes les routes exigent un JWT SuperAdmin.

Événements : `import-created`, `upload-progress`, `extract-progress`, `validation-progress`, `publish-progress`, `cleanup-progress`, `import-success`, `import-failed`.
