const activeDraft = {
  id: "Lot-000124",
  title: "Three-card rookie lot",
  status: "assets_ready",
  detail: "Images are processed and ready for listing draft generation.",
  captureMode: "lot_3_image",
  imageCount: "3 processed assets",
  nextStep: "Add seller hints, then queue AI generation.",
};

const queueCards = [
  { label: "Review", value: "12", tone: "bg-amber-300 text-stone-950" },
  { label: "Approved", value: "4", tone: "bg-emerald-300 text-stone-950" },
  { label: "Blocked", value: "2", tone: "bg-rose-300 text-stone-950" },
];

const workflowStates = [
  "record_created",
  "assets_ready",
  "generating",
  "needs_review",
  "approved_for_export",
  "listed",
];

const settings = [
  ["Capture mode", "single_1_image"],
  ["Order checks", "4 per day"],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#efe7d8] text-stone-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,_rgba(251,191,36,0.38),_transparent_28%),radial-gradient(circle_at_82%_18%,_rgba(20,184,166,0.22),_transparent_30%),linear-gradient(135deg,_rgba(68,64,60,0.08),_transparent_45%)]" />

      <section className="relative mx-auto flex min-h-screen w-[min(96vw,1800px)] flex-col gap-8 px-8 py-8">
        <header className="grid grid-cols-[1fr_24rem] gap-6 rounded-[2rem] border border-stone-950/10 bg-stone-50/80 p-8 shadow-[0_24px_80px_rgba(68,64,60,0.16)] backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-stone-500">
              Murphy Family Hobby
            </p>
            <h1 className="mt-4 max-w-5xl text-6xl font-semibold tracking-[-0.04em] text-balance">
              Local command center for listing workflow state.
            </h1>
          </div>

          <div className="flex flex-col justify-between rounded-[1.5rem] bg-stone-950 p-5 text-stone-50">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-400">
              Phase 0 shell
            </span>
            <div className="mt-8">
              <p className="text-3xl font-semibold">Backend-ready</p>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Static UI frame for listings, queues, settings, and workflow state while backend
                services come online.
              </p>
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_24rem] gap-5">
          <section className="rounded-[2rem] border border-stone-950/10 bg-white/75 p-7 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
                  Listings
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Active drafts</h2>
              </div>
              <span className="rounded-full border border-stone-950/10 bg-stone-100 px-4 py-2 text-sm text-stone-600">
                1 active draft
              </span>
            </div>

            <article className="mt-6 min-h-[34rem] rounded-[1.75rem] border border-stone-950/10 bg-stone-50/80 p-6">
              <div className="grid grid-cols-[11rem_1fr_auto] items-start gap-5">
                <p className="font-mono text-sm text-stone-500">{activeDraft.id}</p>
                <div>
                  <h3 className="text-3xl font-semibold tracking-[-0.03em] text-stone-950">
                    {activeDraft.title}
                  </h3>
                  <p className="mt-3 max-w-4xl text-base leading-7 text-stone-600">
                    {activeDraft.detail}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-stone-950 px-4 py-2 text-xs font-semibold text-stone-50">
                  {activeDraft.status}
                </span>
              </div>

              <div className="mt-8 grid grid-cols-[1.15fr_0.85fr] gap-5">
                <section className="rounded-[1.5rem] border border-stone-950/10 bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">
                    Asset workspace
                  </p>
                  <div className="mt-5 grid grid-cols-3 gap-4">
                    {["Front image", "Back image", "Detail image"].map((label, index) => (
                      <div
                        key={label}
                        className="flex aspect-[4/3] flex-col justify-between rounded-2xl bg-[linear-gradient(135deg,_rgba(231,229,228,0.95),_rgba(214,211,209,0.65))] p-4"
                      >
                        <span className="font-mono text-xs text-stone-500">0{index + 1}</span>
                        <span className="text-sm font-semibold text-stone-700">{label}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-stone-950/10 bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">
                    Draft readiness
                  </p>
                  <dl className="mt-5 space-y-4">
                    {[
                      ["Capture mode", activeDraft.captureMode],
                      ["Assets", activeDraft.imageCount],
                      ["Next step", activeDraft.nextStep],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-sm text-stone-500">{label}</dt>
                        <dd className="mt-1 text-base font-semibold leading-6">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </article>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-[2rem] border border-stone-950/10 bg-stone-950 p-6 text-stone-50 shadow-[0_18px_60px_rgba(28,25,23,0.22)]">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-400">Queue</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {queueCards.map((card) => (
                  <div key={card.label} className={`rounded-2xl p-4 ${card.tone}`}>
                    <p className="text-3xl font-semibold">{card.value}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] opacity-70">
                      {card.label}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-stone-950/10 bg-white/75 p-6 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
                Settings
              </p>
              <dl className="mt-5 space-y-4">
                {settings.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-stone-500">{label}</dt>
                    <dd className="text-right font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>

        <section className="rounded-[2rem] border border-stone-950/10 bg-stone-50/80 p-6 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
                Workflow State
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                Status rail for backend phases
              </h2>
            </div>
            <span className="rounded-full bg-stone-950 px-4 py-2 text-sm text-stone-50">
              Read-only shell
            </span>
          </div>

          <div className="mt-6 grid grid-cols-6 gap-3">
            {workflowStates.map((state, index) => (
              <div key={state} className="rounded-2xl border border-stone-950/10 bg-white p-4">
                <p className="font-mono text-xs text-stone-400">0{index + 1}</p>
                <p className="mt-3 break-words text-sm font-semibold">{state}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
