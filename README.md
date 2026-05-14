# ebay-ui-app

`ebay-ui-app` is a local-only Next.js UI for a dedicated eBay inventory manager.

## Local Architecture

- `ebay-ui-app` runs as its own app repo.
- `ebay-mcp` remains a separate local sidecar service and separate repo.
- Future eBay integration should happen in Next.js server routes or server actions, not from browser-direct MCP calls.
- Adding `ebay-mcp` to `~/.codex/config.toml` is optional developer tooling for Codex or other MCP-capable agents. It is not part of the app runtime contract.

## Commands

- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run build`
