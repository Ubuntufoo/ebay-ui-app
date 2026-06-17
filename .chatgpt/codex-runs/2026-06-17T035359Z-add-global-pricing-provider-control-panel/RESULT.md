# CODEX_RESULT
status: completed
summary: Added compact global Pricing Provider panel with server-backed save/rollback flow below shortened capture-mode controls.
changed_files:
- app/listings-realtime.tsx
- app/listings-realtime.test.tsx
- app/page.tsx
- app/pricing-provider-actions.ts
- lib/sidecar-api/client.test.ts
- lib/sidecar-api/client.ts
- lib/sidecar-api/index.ts
- lib/sidecar-api/types.ts
commands_run:
- pnpm typecheck
- pnpm test -- listings-realtime
- pnpm test -- sidecar-api
tests:
- pnpm typecheck: passed
- pnpm test -- listings-realtime: passed
- pnpm test -- sidecar-api: passed
acceptance_criteria:
- Dashboard now renders compact Pricing Provider panel directly below compact Single/Lot capture controls.
- Initial provider mode hydrates from app settings `pricing_provider_mode`.
- Off/SoldComps/Apify segmented control saves via server action -> sidecar PATCH `{ pricingProviderMode }`.
- Buttons disable during save; failed save restores previous mode and shows compact error.
- Sidecar API types/client now expose pricing provider mode update contract.
- Focused realtime/client tests cover initial mode, save, in-flight disabled state, rollback/error, request payload, and compact capture controls.
blockers:
- none
followups:
- none
