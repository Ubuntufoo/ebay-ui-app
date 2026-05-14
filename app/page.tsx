export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f4efe6,_#f1e7d8_42%,_#d8d0c2_100%)] px-6 py-10 text-stone-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col justify-between rounded-[2rem] border border-stone-900/10 bg-white/70 p-8 shadow-[0_24px_80px_rgba(54,41,28,0.14)] backdrop-blur md:p-12">
        <div className="space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div className="rounded-full border border-stone-900/10 bg-stone-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-stone-50">
              Local Inventory Manager
            </div>
            <div className="text-sm text-stone-600">Next.js 16 · React 19 · Tailwind v4</div>
          </div>

          <div className="grid gap-8 md:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-5">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-stone-500">
                ebay-ui-app
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-balance md:text-7xl">
                A dedicated local UI for managing eBay inventory.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-stone-700">
                This app is scaffolded as a standalone Next.js workspace. It will later call a
                local `ebay-mcp` sidecar from server-side routes and actions, keeping MCP
                transport out of the browser.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-stone-900/10 bg-stone-950 p-6 text-stone-50 shadow-[0_18px_48px_rgba(15,23,42,0.35)]">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">Runtime Shape</p>
              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <dt className="text-stone-400">UI repo</dt>
                  <dd className="max-w-[14rem] text-right">Standalone Next.js application</dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <dt className="text-stone-400">MCP server</dt>
                  <dd className="max-w-[14rem] text-right">Separate local sidecar service</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-stone-400">Browser access</dt>
                  <dd className="max-w-[14rem] text-right">Not direct; server-side bridge later</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="grid gap-4 pt-10 text-sm text-stone-600 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-900/10 bg-stone-50/80 p-5">
            <p className="font-semibold text-stone-900">Scaffold complete</p>
            <p className="mt-2">Project config aligns with the `tc-manager` stack baseline.</p>
          </div>
          <div className="rounded-2xl border border-stone-900/10 bg-stone-50/80 p-5">
            <p className="font-semibold text-stone-900">Sidecar boundary</p>
            <p className="mt-2">Future eBay access will come through a local HTTP-based MCP adapter.</p>
          </div>
          <div className="rounded-2xl border border-stone-900/10 bg-stone-50/80 p-5">
            <p className="font-semibold text-stone-900">Agent-ready</p>
            <p className="mt-2">Agent files are copied in so project-specific workflows can evolve here.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
