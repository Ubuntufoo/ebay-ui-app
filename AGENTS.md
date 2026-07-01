## Repo Overview

`ebay-ui-app` is the Next.js front end for Murphy Family Hobby's eBay inventory manager. This repo owns the UI, browser-safe Supabase client usage, local API routes, tests, and presentation logic for listings and orders.

Keep backend-only work in the separate `backend-services` repo. In this repo, prefer UI components, server actions, and Next.js route handlers over direct browser calls to external services.

## Key Commands

- Install dependencies: `pnpm install`
- Dev server: `pnpm dev`
- Lint: `pnpm lint`
- Tests: `pnpm test`
- Typecheck: `pnpm typecheck`
- Production build: `pnpm build`

## Repo Layout

- `app/` - App Router pages, route handlers, server actions, and UI state modules
- `app/api/` - local API routes used by the UI
- `app/*.test.tsx` / `app/*.test.ts` - Vitest coverage for UI and state logic
- `README.md` - local setup, architecture notes, and command summary
- `env.example` - UI environment variable template

Shared delegate root alias for this repo: `ebay-ui-app`.

## Environment

Use browser-safe env values in the client:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-side or local integration values:

- `SIDECAR_API_URL`
- `SIDECAR_API_BEARER_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`

Legacy fallbacks still exist in the template for migration purposes:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Treat secrets as local-only. Do not hardcode credentials, tokens, or private endpoints into tracked source.

## Working Rules

- Prefer `pnpm` scripts already defined in `package.json`.
- Keep changes aligned with the App Router and existing test patterns.
- Preserve or extend existing state modules and tests when changing listing/order flows.
- When touching Supabase code, respect the browser vs server split already used in the repo.
- Avoid editing generated files unless the framework requires it.

## Validation

- Run `pnpm lint` before finishing UI code changes.
- Run `pnpm test` for behavior changes.
- Run `pnpm build` when changes affect routing, server code, or production bundling.
