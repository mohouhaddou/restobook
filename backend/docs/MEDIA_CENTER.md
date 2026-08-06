# iFilino Media Center

The `media` table is the canonical media source for Kids, Discover, Sports, and Play. Never add provider URLs to Markdown or entity metadata.

## Install

Run `npm run migrate:media` from `backend`, then restart the API. Set `YOUTUBE_API_KEY` to enrich YouTube records with ISO-8601 duration and full descriptions. Without it, safe oEmbed metadata and the standard YouTube thumbnail are cached for six hours.

## API

Superadmins can list/create/update/delete `/api/media`, bulk-update `/api/media/bulk/visibility`, bulk-delete `/api/media/bulk/delete`, and persist ordering with `/api/media/bulk/order`. Published story media is public at `/api/stories/:id/media` and returns visible records only.

The React dashboard is `/admin/media`. Saved Story editors expose the Media/Video panel. The public story landing page renders responsive cards and creates the YouTube iframe only after Play is clicked.

## Providers

Providers live in `backend/src/modules/media/providers`. A provider owns URL validation, external-ID extraction, canonicalization, and metadata retrieval. Register a provider in `mediaService.js`; the schema does not change for Vimeo, Dailymotion, Drive, local video, BunnyCDN, or Cloudflare Stream.

## Security and operations

Administrative routes require bearer authentication and the SuperAdmin role. Inputs are allow-listed and validated, Sequelize parameterizes queries, public queries expose only published Story media, embeds use `youtube-nocookie.com`, and rendered text remains React-escaped. Bearer headers are not automatically attached cross-site, avoiding cookie-based CSRF exposure.
