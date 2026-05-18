# Sidecar REST Contract

This frontend reads listings and app settings from the sibling `backend-services` sidecar over HTTP.

## Source of truth

Backend contract inspected from:

- `backend-services/services/sidecar/src/http/data-router.ts`
- `backend-services/services/sidecar/src/schemas/data-api.ts`
- `backend-services/services/sidecar/src/mcp/http-transport.ts`
- `backend-services/packages/data/src/database.ts`
- `backend-services/packages/data/src/database-generated.ts`

## Base URL

- Base URL env var: `SIDECAR_API_URL`
- No frontend fallback default is used
- REST routes are mounted under `/api`

Recommended local development split:

- UI: `http://localhost:3000`
- sidecar: `http://localhost:3001`
- sidecar startup: `MCP_PORT=3001 OAUTH_ENABLED=false`

Examples:

- `GET {SIDECAR_API_URL}/api/listings`
- `GET {SIDECAR_API_URL}/api/listings/:listingId`
- `PATCH {SIDECAR_API_URL}/api/listings/:listingId`
- `GET {SIDECAR_API_URL}/api/app-settings`

## Response shapes

### `GET /api/listings`

Returns:

```json
{
  "listings": [
    {
      "id": "uuid",
      "listing_id": "LIST-001",
      "title": "Example title",
      "status": "record_created",
      "sub_status": "idle",
      "created_at": "2026-05-17T12:00:00.000Z",
      "updated_at": "2026-05-17T12:00:00.000Z"
    }
  ]
}
```

Note: the real payload includes the full `listings` table row, not a reduced DTO.

### `GET /api/listings/:listingId`

Returns the full `listings` table row for the matching `listing_id`.

### `PATCH /api/listings/:listingId`

Updates seller-editable listing fields and returns the full updated `listings` table row.

The request body uses camelCase JSON keys; the backend maps them to the corresponding snake_case `listings` columns.

Request body:

```json
{
  "sellerHints": "Optional seller note",
  "title": "Updated title",
  "description": "Updated description",
  "price": 19.99,
  "categoryId": "12345",
  "itemSpecifics": {
    "Brand": "Example"
  },
  "conditionId": "1000",
  "conditionNotes": "Minor wear"
}
```

Allowed editable fields:

- `sellerHints` (`seller_hints`)
- `title` (`title`)
- `description` (`description`)
- `price` (`price`)
- `categoryId` (`category_id`)
- `itemSpecifics` (`item_specifics`)
- `conditionId` (`condition_id`)
- `conditionNotes` (`condition_notes`)

Do not send:

- `id`
- `listingId` / `listing_id`
- `status`
- `subStatus` / `sub_status`
- `created_at`
- `updated_at`
- `ebay_listing_id`
- `ebay_listing_status`
- `ebay_listing_url`
- `ebay_offer_id`
- `approved_for_export_at`
- `capture_mode`
- `ese_eligible`
- `estimated_weight_oz`
- `exported_at`
- `handling_days`
- `image_urls`
- `last_error_at`
- `last_error_code`
- `listing_type`
- `merchant_location_key`
- `package_type`
- `r2_delete_after`
- `r2_deleted_at`
- `r2_object_keys`
- `r2_retention_policy`
- `shipping_profile`
- `sku`
- any other non-editable or unknown fields

Response shape:

- HTTP `200`
- JSON body is the full updated `Listing` row, the same shape returned by `GET /api/listings/:listingId`

Notes:

- The sidecar schema is strict, so unexpected keys are rejected with `400`.
- The backend maps these request fields onto the editable `listings` columns before persisting the update.

### `GET /api/app-settings`

Returns the full `app_settings` table row for the default `id` of `"default"`.

## Error shapes

Validation failures return HTTP `400`:

```json
{
  "error": "invalid_request",
  "details": [
    {
      "message": "Required",
      "path": "listingId"
    }
  ]
}
```

Not found returns HTTP `404`:

```json
{
  "error": "not_found",
  "message": "Listing \"LIST-001\" was not found."
}
```

Unexpected failures return HTTP `500`:

```json
{
  "error": "server_error",
  "message": "An unexpected server error occurred."
}
```

## Auth behavior

Current backend code protects `/api` with bearer-token auth unless the sidecar is started with `OAUTH_ENABLED=false`.

- Default backend behavior: auth enabled
- Local unauthenticated dev mode: start the sidecar with `MCP_PORT=3001 OAUTH_ENABLED=false`
- Frontend support added here: optional `SIDECAR_API_BEARER_TOKEN` env var for server-side requests

Important: the current frontend README previously mentioned `SIDECAR_API_KEY`, but that header-based API key flow was not found in the current backend route code. Treat bearer-token auth or `OAUTH_ENABLED=false` as the active contract unless the backend changes.

## CORS / proxying

The sidecar enables CORS with `origin: "*"` in `http-transport.ts`, so cross-origin requests are allowed in local development. Same-origin proxying is not required for read endpoints; however, write endpoints like `PATCH /api/listings/:listingId` are available for server-side mutations.

## Frontend assumption

The new frontend client is intentionally server-only. That keeps any optional bearer token out of the browser and preserves the intended data path:

`FE -> sidecar REST API -> shared repositories -> Supabase`
