# ebay-ui-app

`ebay-ui-app` is a local-only Next.js UI for Murphy Family Hobby's eBay inventory manager.

## Local Architecture

- `ebay-ui-app` runs as its own app repo.
- `backend-services` remains the separate server-side repo for OAuth, API calls, jobs, and other backend-only concerns.
- Future eBay integration should happen in Next.js server routes or server actions, not from browser-direct MCP calls.

## Environment

The UI only needs client-side or browser-safe values:

- `NEXT_PUBLIC_SUPABASE_URL` - browser-safe Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - browser-safe publishable key used by the UI realtime client
- `SIDECAR_API_URL` - required sidecar REST base URL

Legacy compatibility:

- `SUPABASE_URL` can still backfill the browser URL when `NEXT_PUBLIC_SUPABASE_URL` is not set.
- `SUPABASE_ANON_KEY` can still backfill the browser realtime key, but only when its JWT `role` claim is `anon`.

Server-side sidecar access can also use:

- `SIDECAR_API_BEARER_TOKEN` - optional bearer token for sidecar REST requests when OAuth is enabled

Server-side Supabase access for privileged actions also uses:

- `SUPABASE_SERVICE_ROLE_KEY` - required for server actions that need direct Supabase writes

The current backend route code protects `/api` with bearer-token auth unless the sidecar runs with `OAUTH_ENABLED=false`. A legacy `SIDECAR_API_KEY` flow was not found in the current backend route implementation.

Recommended local setup:

- run the UI on `http://localhost:3000`
- run the sidecar on `http://localhost:3002`
- set `SIDECAR_API_URL=http://localhost:3002`
- start the sidecar with `MCP_PORT=3002 OAUTH_ENABLED=false`

Feature-branch launch commands (each in its own terminal):

```bash
# backend-services — Sidecar HTTP (only process listening on 3002)
MCP_HOST=localhost MCP_PORT=3002 SIDECAR_API_URL=http://localhost:3002 OAUTH_ENABLED=false EBAY_PUBLISH_ENABLED=false pnpm dev:sidecar

# backend-services — watcher client (does not bind an HTTP listener)
SIDECAR_API_URL=http://localhost:3002 MCP_PORT=3002 pnpm --filter @ebay-inventory/watcher-service dev

# ebay-ui-app — Next.js UI (only process listening on 3000)
SIDECAR_API_URL=http://localhost:3002 PORT=3000 pnpm dev
```

Stop each process with `Ctrl-C` and restart all three after env changes;
Next.js and the backend load env at process startup. Shell assignments above
override dotenv files, preventing a stale `3001` value from becoming an
implicit Sidecar target.

Read-only checks:

```bash
curl --fail-with-body http://localhost:3002/health
curl --fail-with-body http://localhost:3002/api/variation-listings/f6364eb4-489b-450b-9a83-ced85526b90f
curl --fail-with-body http://localhost:3000/api/variation-listings

# Compare the same ProductionPilot02 group through the UI proxy and Sidecar.
GROUP_ID=f6364eb4-489b-450b-9a83-ced85526b90f
curl --fail-with-body http://localhost:3000/api/variation-listings \
  | jq --arg id "$GROUP_ID" '.groups[] | select(.groupId == $id) | {groupId, desiredRevision, lifecycleState, journal}'
curl --fail-with-body "http://localhost:3002/api/variation-listings/$GROUP_ID" \
  | jq '{groupId, desiredRevision, lifecycleState, journal}'
```

Compare `groupId`, `desiredRevision`, `lifecycleState`, and the `journal`
summary (especially its latest revision/checkpoint state). These commands are
GET-only and do not mutate eBay, Supabase, R2, or Sidecar state.

See [`env.example`](env.example) for the UI env template.

See [`docs/sidecar-rest-contract.md`](docs/sidecar-rest-contract.md) for the assessed REST contract used by the frontend client.

## Commands

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run build`
