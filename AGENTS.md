# AGENTS

## Project Overview

Murphy Family Hobby's eBay Inventory Manager — a local-first desktop/web app for creating and managing eBay listings. The application manages media, generates listing content with AI, persists listings in a central database, and communicates with eBay's developer APIs for publishing and inventory/sales management.

This repository contains the UI and tooling for a local-first listing workflow:

- Watcher: detects new assets, processes images, and uploads originals/derivatives to R2.
- Gemini: analyzes images and helps generate listing content and metadata.
- Supabase: source of truth for drafts, listings, assets, audit trails, and settings.
- eBay APIs: listing creation, updates, inventory sync, and order lookups.

## Architecture Split

The UI is separated from the sibling `backend-services` repo, which handles OAuth, eBay API calls, queued jobs, R2 proxying, and AI integrations. The UI talks to it over authenticated HTTP APIs or Supabase events.

## Scope for Agents / Automation

- Watcher: watches folders, transforms images, uploads to R2, and writes asset records to Supabase.
- AI: requests Gemini analysis and turns results into validated draft objects.
- Sync: reconciles Supabase state with eBay and handles retries/errors.
- Orchestration: sequences Watcher → AI → Draft creation → User review → eBay publish.

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

- R2: stores image assets; credentials stay in env vars.
- Gemini: image understanding/generation; gate and rate-limit calls.
- Supabase: primary database/auth; migrations live in `migrations/` when present.
- eBay APIs: publish/update listings; keep credentials private and use sandbox keys for testing.

## Backend Services Sidecar

`backend-services` provides the sidecar that handles eBay/OAuth work, asset proxying, and background jobs.

- API contract:
  - `POST /sidecar/publish` — enqueue a listing publish job
  - `POST /sidecar/sync` — request immediate sync
  - `GET /sidecar/listings/:id/status` — fetch publish/sync status
  - `POST /sidecar/assets/proxy` — optional proxy for protected R2 assets
  - `GET /health` — liveness + readiness

- Integration: the UI writes drafts/assets to Supabase; the sidecar watches events or accepts UI requests and performs backend work over authenticated HTTP/JSON.
- Run locally from the `backend-services` root, for example:

```bash
cd ../backend-services
pnpm dev
```

- UI env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optional `SIDECAR_API_URL`.
- Keep backend/server secrets in `backend-services`; do not duplicate them here.
