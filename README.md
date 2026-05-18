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
- `SIDECAR_API_URL` - required sidecar REST base URL

Server-side sidecar access can also use:

- `SIDECAR_API_BEARER_TOKEN` - optional bearer token for sidecar REST requests when OAuth is enabled

The current backend route code protects `/api` with bearer-token auth unless the sidecar runs with `OAUTH_ENABLED=false`. A legacy `SIDECAR_API_KEY` flow was not found in the current backend route implementation.

Recommended local setup:

- run the UI on `http://localhost:3000`
- run the sidecar on `http://localhost:3001`
- set `SIDECAR_API_URL=http://localhost:3001`
- start the sidecar with `MCP_PORT=3001 OAUTH_ENABLED=false`

See [`env.example`](env.example) for the UI env template.

See [`docs/sidecar-rest-contract.md`](docs/sidecar-rest-contract.md) for the assessed REST contract used by the frontend client.

## Commands

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run build`
