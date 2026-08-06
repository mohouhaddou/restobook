# Media Center Phase 2

Phase 2 turns Media Center into a reusable asset library. `media` stores provider assets; `media_links` attaches one asset to any number of Stories, Articles, or Games. Legacy ownership columns remain nullable compatibility mirrors and are backfilled into links by the migration.

## Deployment

1. Back up MySQL.
2. Run `npm run migrate:media` if Phase 1 was not installed.
3. Run `npm run migrate:media:phase2`.
4. Configure `MEDIA_RETENTION_DAYS` (default 30), `MEDIA_UPLOAD_MAX_BYTES` (default 250 MB), `MEDIA_JOB_INTERVAL_MS` (default 24 hours), and optional `YOUTUBE_API_KEY`.
5. Restart the primary API process. It schedules metadata sync, dead-link status updates, unused-media detection, and retention cleanup. Workers may instead be invoked through `media:sync`, `media:check`, and `media:cleanup`.

The migration preserves every old attachment, merges duplicate provider/external-ID assets only after copying their links, and does not cascade Story deletion into `media`.

## APIs

- `/api/media`: cursor-based searchable asset library with ETags and legacy-compatible CRUD.
- `/api/media/upload`: deduplicated local video/image/audio/PDF/ZIP upload.
- `/api/media/:id/links`: attach or detach reusable assets.
- `/api/media/collections`, `/api/media/tags`, `/api/media/:id/translations/:language`.
- `/api/media/:id/versions` and `/rollback/:version`.
- `/api/media/trash` and `/api/media/:id/restore`.
- `/api/media/:id/thumbnail` and `/regenerate-thumbnail`.
- `/api/media/stats`, `/api/media/analytics`, and public event ingestion.

Bulk endpoints cover edit, assign/move, visibility, language, deletion, ordering, collections, and tags. Public Story responses retain flattened legacy fields while sourcing attachment state from `media_links`.

## Extensibility

Providers implement ID extraction and metadata resolution under `providers/`. AI processors register with `ai/MediaAiPipeline`; their outputs are namespaced under `media.metadata.ai`, allowing tagging, descriptions, transcripts, speech-to-text, scene detection, summaries, quiz generation, subtitles, thumbnail scoring, SEO, and related-content suggestions without schema changes.
