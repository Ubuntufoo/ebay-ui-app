import { Suspense } from "react";

import { CreateListingForm } from "@/app/create-listing-form";
import { SidecarApiError, listListings, type Listing } from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

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

function formatPrice(price: number | null): string {
  if (price === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(price);
}

function formatUpdatedAt(updatedAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(updatedAt));
}

function ListingsTable({ listings }: { listings: Listing[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-stone-950/10 bg-stone-50/80">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-950/10 bg-stone-100/80 text-left">
              {["listing_id", "status", "sub_status", "title", "price", "updated_at"].map(
                (column) => (
                  <th
                    key={column}
                    className="px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-stone-500"
                  >
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id} className="border-b border-stone-950/10 last:border-b-0">
                <td className="px-5 py-4 font-mono text-sm text-stone-600">{listing.listing_id}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-stone-50">
                    {listing.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-stone-600">{listing.sub_status}</td>
                <td className="px-5 py-4 text-sm font-semibold text-stone-900">
                  {listing.title ?? "Untitled listing"}
                </td>
                <td className="px-5 py-4 text-sm text-stone-600">{formatPrice(listing.price)}</td>
                <td className="px-5 py-4 text-sm text-stone-600">
                  {formatUpdatedAt(listing.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ListingsEmptyState() {
  return (
    <div className="mt-6 flex min-h-[22rem] items-center justify-center rounded-[1.75rem] border border-dashed border-stone-950/15 bg-stone-50/70 px-6 text-center">
      <div className="max-w-lg">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-500">No listings</p>
        <p className="mt-3 text-lg leading-8 text-stone-600">
          The sidecar returned an empty listings collection. New drafts will appear here once they
          exist.
        </p>
      </div>
    </div>
  );
}

function ListingsErrorState({ message }: { message: string }) {
  return (
    <div className="mt-6 flex min-h-[22rem] items-center justify-center rounded-[1.75rem] border border-rose-300/70 bg-rose-50/80 px-6 text-center">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-700">Listings unavailable</p>
        <p className="mt-3 text-lg leading-8 text-rose-900">{message}</p>
      </div>
    </div>
  );
}

function ListingsLoadingState() {
  return (
    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-stone-950/10 bg-stone-50/80">
      <div className="border-b border-stone-950/10 bg-stone-100/80 px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
        Loading listings
      </div>
      <div className="space-y-3 p-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(231,229,228,0.9),rgba(245,245,244,0.9),rgba(231,229,228,0.9))]"
          />
        ))}
      </div>
    </div>
  );
}

async function ListingsSection() {
  const result = await loadListings();

  if (result.status === "error") {
    return (
      <>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">Listings</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Inventory records</h2>
          </div>
          <span className="rounded-full border border-rose-300/70 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            Request failed
          </span>
        </div>

        <ListingsErrorState message={result.message} />
      </>
    );
  }

  const { listings } = result;

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">Listings</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Inventory records</h2>
        </div>
        <span className="rounded-full border border-stone-950/10 bg-stone-100 px-4 py-2 text-sm text-stone-600">
          {listings.length} {listings.length === 1 ? "listing" : "listings"}
        </span>
      </div>

      {listings.length === 0 ? <ListingsEmptyState /> : <ListingsTable listings={listings} />}
    </>
  );
}

async function loadListings(): Promise<
  | { status: "success"; listings: Listing[] }
  | { status: "error"; message: string }
> {
  try {
    return {
      status: "success",
      listings: await listListings(),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof SidecarApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading listings.",
    };
  }
}

function ListingsSectionFallback() {
  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">Listings</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Inventory records</h2>
        </div>
        <span className="rounded-full border border-stone-950/10 bg-stone-100 px-4 py-2 text-sm text-stone-600">
          Loading
        </span>
      </div>

      <ListingsLoadingState />
    </>
  );
}

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
                Dashboard shell connected to sidecar-backed listing reads while edit and workflow
                actions remain out of scope.
              </p>
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_24rem] gap-5">
          <section className="rounded-[2rem] border border-stone-950/10 bg-white/75 p-7 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur">
            <Suspense fallback={<ListingsSectionFallback />}>
              <ListingsSection />
            </Suspense>
          </section>

          <aside className="grid gap-5">
            <CreateListingForm />

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
