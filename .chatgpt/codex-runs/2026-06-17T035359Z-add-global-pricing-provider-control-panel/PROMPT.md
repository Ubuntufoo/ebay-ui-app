# Codex Task
Run ID: 2026-06-17T035359Z-add-global-pricing-provider-control-panel
## Objective
Add a compact global Pricing Provider control panel below the Single/Lot capture-mode panel on the dashboard, backed by app_settings.pricing_provider_mode.
## Context Summary
Roadmap item 9J.11 was clarified: the selector is global, not per-listing. Backend already persists provider mode in app_settings as `off | soldcomps | apify` and exposes it from GET /api/app-settings. PATCH /api/app-settings accepts `{ pricingProviderMode: 'off' | 'soldcomps' | 'apify' }`. The existing dashboard right column currently contains only the Single/Lot capture-mode panel in `app/listings-realtime.tsx`; make that panel shorter and place the new pricing provider panel directly below it. Keep the UI compact and responsive on laptop-sized screens.
## Inspect First

- app/listings-realtime.tsx
- app/listings-realtime.test.tsx
- app/page.tsx
- lib/sidecar-api/client.ts
- lib/sidecar-api/types.ts
- lib/sidecar-api/index.ts

## Allowed Paths

- app/listings-realtime.tsx
- app/listings-realtime.test.tsx
- app/page.tsx
- app/*pricing*provider*.tsx
- app/*pricing*provider*.ts
- lib/sidecar-api/client.ts
- lib/sidecar-api/types.ts
- lib/sidecar-api/index.ts

## Forbidden Paths

- backend-services/**
- supabase/**
- node_modules/**
- .next/**

## Implementation Scope

Include:
- Add a dashboard Pricing Provider panel below the Single/Lot capture-mode panel.
- Make the Single/Lot panel shorter to fit the new pricing provider controls; reduce button height/text size without changing behavior.
- Render a segmented control with options: Off, SoldComps, Apify.
- Initial selected value must come from app settings `pricing_provider_mode`.
- Persist mode changes through PATCH /api/app-settings using top-level camelCase payload `{ pricingProviderMode }`.
- Handle saving/loading state by disabling the segmented buttons while a save is in flight.
- Show a compact error message if save fails, and restore the previous selected mode after failure.
- Keep the control global; do not attach provider mode to individual listings.
- Add or update sidecar API types/client exports for pricing provider mode update if missing.
- Add focused tests for initial selected mode, successful save, disabled/saving state, failed save rollback/error, and capture-mode panel still rendering compact Single/Lot controls.

Exclude:
- Do not change backend APIs.
- Do not modify pricing modifier checkboxes beside Generate.
- Do not add per-listing provider mode fields.
- Do not change realtime listing subscription behavior except if the refresh payload needs to retain the current app settings mode.
- Do not redesign unrelated dashboard/listing table UI.

## Acceptance Criteria

- Dashboard shows a compact Pricing Provider panel directly below the Single/Lot panel.
- Single/Lot panel remains functional and visibly shorter than the previous min-h-20/text-2xl layout.
- Off, SoldComps, and Apify options render as a segmented/radio-style control.
- Selected provider reflects initial app settings mode.
- Clicking a provider saves via PATCH /api/app-settings with `{ pricingProviderMode: 'off' | 'soldcomps' | 'apify' }`.
- Buttons are disabled while saving.
- Failed save displays an error and restores the prior selected mode.
- No listing-level data shape changes are introduced.
- Existing listings realtime and generate/edit tests continue to pass.

## Verification Commands

- pnpm typecheck
- pnpm test -- listings-realtime
- pnpm test -- sidecar-api

## Completion Contract
Before your final chat response, write this file:
`.chatgpt/codex-runs/2026-06-17T035359Z-add-global-pricing-provider-control-panel/RESULT.md`
Use this exact structure:
```md
# CODEX_RESULT
status: completed | blocked
summary: <one-line summary>
changed_files:
commands_run:
tests:
acceptance_criteria:
blockers:
followups:
```
Then print the same result in the Codex chat.
Do not stage, commit, push, or edit unrelated files.
Do not edit `.chatgpt/**` except this run's `RESULT.md`.