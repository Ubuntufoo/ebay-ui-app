import {Suspense} from "react";

import {CreateListingForm} from "@/app/create-listing-form";
import {ListingsRealtime} from "@/app/listings-realtime";
import {
  SidecarApiError,
  getAppSettings,
  listListings,
  type AppSettings,
  type Listing,
} from "@/lib/sidecar-api";
import {
  getListingsRealtimePublicKey,
  getListingsRealtimePublicUrl,
} from "@/lib/supabase/public-key";

export const dynamic = "force-dynamic";

const workflowStates = [
  "record_created",
  "assets_ready",
  "generating",
  "needs_review",
  "approved_for_export",
  "listed",
];

function ListingsEmptyState() {
  return (
    <div className="mt-6 flex min-h-[22rem] items-center justify-center rounded-[1.75rem] border border-dashed border-stone-950/15 bg-stone-50/70 px-6 text-center">
      <div className="max-w-lg">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-500">
          No listings
        </p>
        <p className="mt-3 text-lg leading-8 text-stone-600">
          The sidecar returned an empty listings collection. New drafts will
          appear here once they exist.
        </p>
      </div>
    </div>
  );
}

function ListingsErrorState({message}: {message: string}) {
  return (
    <div className="mt-6 flex min-h-[22rem] items-center justify-center rounded-[1.75rem] border border-rose-300/70 bg-rose-50/80 px-6 text-center">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-700">
          Listings unavailable
        </p>
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
        {Array.from({length: 5}).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(231,229,228,0.9),rgba(245,245,244,0.9),rgba(231,229,228,0.9))]"
          />
        ))}
      </div>
    </div>
  );
}

type ListingsLoadResult =
  | {status: "success"; listings: Listing[]}
  | {status: "error"; message: string};

function buildQueueCards(listings: Listing[]) {
  const intakeCreatedCount = listings.filter(
    (listing) => listing.status === "record_created",
  ).length;
  const assetsReadyCount = listings.filter(
    (listing) => listing.status === "assets_ready",
  ).length;
  const needsAttentionCount = listings.filter((listing) =>
    Boolean(listing.last_error_code),
  ).length;

  return [
    {
      label: "Intake created",
      value: String(intakeCreatedCount),
      tone: "bg-amber-300 text-stone-950",
    },
    {
      label: "Assets ready",
      value: String(assetsReadyCount),
      tone: "bg-emerald-300 text-stone-950",
    },
    {
      label: "Needs attention",
      value: String(needsAttentionCount),
      tone: "bg-rose-300 text-stone-950",
    },
  ] as const;
}

async function ListingsSection({
  listingsPromise,
}: {
  listingsPromise: Promise<ListingsLoadResult>;
}) {
  const listingsResult = await listingsPromise;

  if (listingsResult.status === "error") {
    return (
      <>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
              Listings
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
              Inventory records
            </h2>
          </div>
          <span className="rounded-full border border-rose-300/70 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            Request failed
          </span>
        </div>

        <ListingsErrorState message={listingsResult.message} />
      </>
    );
  }

  const {listings} = listingsResult;

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
            Listings
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
            Inventory records
          </h2>
        </div>
        <span className="rounded-full border border-stone-950/10 bg-stone-100 px-4 py-2 text-sm text-stone-600">
          {listings.length} {listings.length === 1 ? "listing" : "listings"}
        </span>
      </div>

      {listings.length === 0 ? (
        <ListingsEmptyState />
      ) : (
        <ListingsRealtime
          initialListings={listings}
          realtimeAnonKey={getListingsRealtimePublicKey()}
          realtimeUrl={getListingsRealtimePublicUrl()}
        />
      )}
    </>
  );
}

async function loadListings(): Promise<
  ListingsLoadResult
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

async function loadAppSettings(): Promise<
  | {status: "success"; settings: AppSettings}
  | {status: "error"; message: string}
> {
  try {
    return {
      status: "success",
      settings: await getAppSettings(),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof SidecarApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading app settings.",
    };
  }
}

function formatSettingValue(value: string | number | null): string {
  if (value === null) {
    return "—";
  }

  return String(value);
}

async function AppSettingsSection() {
  const settingsResult = await loadAppSettings();

  return (
    <section className="rounded-[2rem] border border-stone-950/10 bg-white/75 p-6 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
        App settings
      </p>
      {settingsResult.status === "success" ? (
        <dl className="mt-5 space-y-4">
          {[
            ["Capture mode", settingsResult.settings.capture_mode],
            ["Handling days", settingsResult.settings.handling_days],
            [
              "Merchant location key",
              settingsResult.settings.merchant_location_key,
            ],
            [
              "Shipping profile",
              settingsResult.settings.default_shipping_profile,
            ],
            ["Package type", settingsResult.settings.default_package_type],
            ["Marketplace", settingsResult.settings.ebay_marketplace_id],
            ["Order syncs/day", settingsResult.settings.max_order_syncs_per_day],
            ["Gemini daily limit", settingsResult.settings.gemini_daily_limit],
            [
              "R2 retention days after sold",
              settingsResult.settings.r2_retention_days_after_sold,
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <dt className="text-sm text-stone-500">{label}</dt>
              <dd className="text-right font-semibold">
                {formatSettingValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {settingsResult.message}
        </p>
      )}
    </section>
  );
}

function AppSettingsSectionFallback() {
  return (
    <section className="rounded-[2rem] border border-stone-950/10 bg-white/75 p-6 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
        App settings
      </p>
      <div className="mt-5 space-y-4">
        {Array.from({length: 4}).map((_, index) => (
          <div
            key={index}
            className="h-5 animate-pulse rounded-2xl bg-stone-100"
          />
        ))}
      </div>
    </section>
  );
}

function ListingsSectionFallback() {
  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
            Listings
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
            Inventory records
          </h2>
        </div>
        <span className="rounded-full border border-stone-950/10 bg-stone-100 px-4 py-2 text-sm text-stone-600">
          Loading
        </span>
      </div>

      <ListingsLoadingState />
    </>
  );
}

function QueueSectionFallback() {
  return (
    <section className="rounded-[2rem] border border-stone-950/10 bg-stone-950 p-6 text-stone-50 shadow-[0_18px_60px_rgba(28,25,23,0.22)]">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-400">
        Queue
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Array.from({length: 3}).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-stone-800/70"
          />
        ))}
      </div>
    </section>
  );
}

async function QueueSection({
  listingsPromise,
}: {
  listingsPromise: Promise<ListingsLoadResult>;
}) {
  const listingsResult = await listingsPromise;

  return (
    <section className="rounded-[2rem] border border-stone-950/10 bg-stone-950 p-6 text-stone-50 shadow-[0_18px_60px_rgba(28,25,23,0.22)]">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-400">
        Queue
      </p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">
            Watcher intake
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            Incoming rows surface before asset upload or generation.
          </p>
        </div>
        <span className="rounded-full border border-stone-700 bg-stone-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-300">
          Display only
        </span>
      </div>

      {listingsResult.status === "error" ? (
        <div className="mt-5 rounded-2xl border border-rose-400/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {listingsResult.message}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {buildQueueCards(listingsResult.listings).map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl p-4 ${card.tone}`}
            >
              <p className="text-3xl font-semibold">{card.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] opacity-70">
                {card.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const listingsPromise = loadListings();
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#efe7d8] text-stone-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,_rgba(251,191,36,0.38),_transparent_28%),radial-gradient(circle_at_82%_18%,_rgba(20,184,166,0.22),_transparent_30%),linear-gradient(135deg,_rgba(68,64,60,0.08),_transparent_45%)]" />

      <section className="relative flex min-h-screen w-full flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-stone-950/10 bg-stone-50/85 px-5 py-3 shadow-[0_18px_48px_rgba(68,64,60,0.12)] backdrop-blur">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-stone-500">
              Murphy Family Hobby
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-[-0.03em] sm:text-xl">
              Local command center
            </h1>
          </div>

          <div className="flex items-center gap-3 rounded-full bg-stone-950 px-4 py-2 text-stone-50">
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-stone-400">
              Phase 5 intake
            </span>
            <span className="text-sm font-semibold">Watcher visible</span>
          </div>
        </header>

        <section className="rounded-[2rem] border border-stone-950/10 bg-white/80 p-5 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur sm:p-7">
          <Suspense fallback={<ListingsSectionFallback />}>
            <ListingsSection listingsPromise={listingsPromise} />
          </Suspense>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <CreateListingForm />

          <Suspense fallback={<QueueSectionFallback />}>
            <QueueSection listingsPromise={listingsPromise} />
          </Suspense>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Suspense fallback={<AppSettingsSectionFallback />}>
            <AppSettingsSection />
          </Suspense>

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

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              {workflowStates.map((state, index) => (
                <div
                  key={state}
                  className="rounded-2xl border border-stone-950/10 bg-white p-4"
                >
                  <p className="font-mono text-xs text-stone-400">0{index + 1}</p>
                  <p className="mt-3 break-words text-sm font-semibold">
                    {state}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
