# AGENTS

## Project Overview

Murphy Family Hobby's eBay Inventory Manager — a local-first desktop/web app for creating and managing eBay listings. The application manages media, generates listing content with AI, persists listings in a central database, and communicates with eBay's developer APIs for publishing and inventory/sales management.

This repository contains the UI and tooling that supports the following core workflow:

- Auto-Process (Watcher): watches a local folder or dropzone for new asset files (images), performs local image processing, and uploads originals/derivatives to Cloudflare R2.
- Gemini AI integration: analyzes images and suggests/generated listing titles, descriptions, item specifics, and structured metadata to speed up listing creation.
- Supabase: single source of truth for listings, assets, and sync state — stores drafts, published listings, images, audit trails, and user settings.
- eBay Developer API: handles listing creation, updates, inventory synchronization, and sales/order lookups.

This project is intentionally local-first.

## Architecture Split

The UI is intentionally separated from backend services. The sibling `backend-services` repository hosts server-side responsibilities (OAuth, eBay API interactions, queued jobs, R2 proxies, and AI integrations). The UI communicates with the backend over authenticated HTTP APIs or via Supabase events.

## Scope for Agents / Automation

- Watcher service: monitors configured asset folders, applies image transforms (resize, strip metadata, generate thumbnails), and uploads to Cloudflare R2. It writes asset records to Supabase.
- AI assistant service: requests image analysis from Gemini and converts results into validated listing draft objects that conform to the Supabase schema and eBay listing taxonomy.
- Sync service: reconciles Supabase listing state with eBay (create / update / refresh inventory), handles retry logic, and surfaces errors to the UI.
- Local orchestration: lightweight coordination layer to sequence Watcher → AI → Draft creation → User review → eBay publish.

## Key Commands

- Install dependencies: `pnpm install` (or `npm install` / `pnpm install --frozen-lockfile` depending on your setup)
- Dev server (UI): `pnpm dev`
- Start watcher locally: `pnpm run watcher` (or see `scripts/` for platform-specific commands)
- Run tests: `pnpm test`
- Build: `pnpm build`

## Important Files & Directories

- `src/` — application source, UI components, and agent integration code
- `scripts/watcher/` — image watcher and local auto-processing logic
- `packages/` or `tools/` — helper tooling (if present)
- `README.md` — repo-level usage and local setup notes
- `env.example` — environment variables required for the UI only

## Integrations & Secrets

- Cloudflare R2: used only for storing image assets; credentials live in environment variables and should not be committed.
- Gemini: used for image understanding and generation assistance — calls should be gated behind feature flags and rate-limited.
- Supabase: primary database and auth provider for this app (schema-first design; migrations kept in `migrations/` when present).
- eBay Developer APIs: OAuth and keys used to publish/update listings. Keep developer credentials private and use sandbox keys for testing.

## Backend Services Sidecar

This project pairs with the `backend-services` sibling repository. Its sidecar is a small background service that centralizes platform-specific concerns and safely surfaces eBay and backend operations to the local UI.

- Purpose: manage eBay Developer API interactions (OAuth token refresh, publish queue, inventory sync), act as an asset proxy for signed R2 URLs when needed, and run scheduled/retry jobs outside the UI process.
- API contract (minimal surface):
  - `POST /sidecar/publish` — enqueue a listing publish job (JSON: listing id)
  - `POST /sidecar/sync` — request immediate sync for a listing or inventory item
  - `GET /sidecar/listings/:id/status` — fetch publish/sync status
  - `POST /sidecar/assets/proxy` — optional proxy endpoint to serve protected R2 assets
  - `GET /health` — liveness + readiness

- Integration: the UI writes drafts and asset records to Supabase; the sidecar watches Supabase events or accepts UI requests and performs eBay API calls. Communication is plain HTTP/JSON and authenticated with a local `SIDECAR_API_KEY` (or equivalent) for simplicity.
- Running locally: start the sidecar from the `backend-services` repo root — for example:

```bash
cd ../backend-services
pnpm dev
```

- UI env vars only: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optional `SIDECAR_API_URL`.
- Backend/server-side envs and secrets live in `backend-services`; do not duplicate service keys or OAuth credentials in the UI docs.
- Security: keep `SIDECAR_API_KEY` and OAuth secrets out of source control; restrict sidecar to localhost during development and use CORS, TLS, and authenticated requests in shared environments.

## Contribution Notes

- This is a personal/local-first project: be mindful of changes that assume a hosted backend unless they are guarded by a local-or-remote configuration.
- Keep secrets out of commits. Use `env.example` and local `.env` files for credentials.
