# ebay-ui-app

`ebay-ui-app` is a local-only Next.js UI for Murphy Family Hobby's eBay inventory manager.

## Local Architecture

- `ebay-ui-app` runs as its own app repo.
- `backend-services` remains the separate server-side repo for OAuth, API calls, jobs, and other backend-only concerns.
- Future eBay integration should happen in Next.js server routes or server actions, not from browser-direct MCP calls.
- Adding the backend MCP/server tooling to `~/.codex/config.toml` is optional developer tooling for Codex or other MCP-capable agents. It is not part of the app runtime contract.

## Environment

The UI only needs client-side or browser-safe values:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - public anon key used by the UI
- `SIDECAR_API_URL` - optional; defaults to `http://localhost:3000` for a local sidecar

`SIDECAR_API_KEY` is only needed when a local sidecar requires authentication. Treat it as backend/local-only and keep server-side envs and secrets in [`backend-services`](../backend-services/README.md).

## Commands

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run build`
