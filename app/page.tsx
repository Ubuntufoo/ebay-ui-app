import {Suspense} from "react";
import {ListingsRealtime} from "@/app/listings-realtime";
import {QueueErrorsPanelFallback} from "@/app/queue-errors-panel";
import {
  SidecarApiError,
  getAppSettings,
  getGeminiUsage,
  listListings,
  type AppSettings,
  type GeminiDailyUsageSummary,
  type Listing,
} from "@/lib/sidecar-api";
import {
  countUnshippedOrders,
  listUnshippedOrders,
} from "@/lib/unshipped-orders";
import {
  getListingsRealtimePublicKey,
  getListingsRealtimePublicUrl,
} from "@/lib/supabase/public-key";

export const dynamic = "force-dynamic";

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

type GeminiUsageLoadResult =
  | {status: "success"; geminiUsage: GeminiDailyUsageSummary}
  | {status: "error"};

type UnshippedOrdersLoadResult =
  | {status: "success"; count: number}
  | {status: "error"; message: string};

function OrdersToShipIndicator({count}: {count: number}) {
  return (
    <a
      href="/orders"
      className="inline-flex items-center gap-2 rounded-full border border-stone-950/10 bg-white/80 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
    >
      <span>Orders to ship:</span>
      <span
        className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] ${
          count > 0
            ? "bg-amber-200 text-amber-950"
            : "bg-stone-100 text-stone-600"
        }`}
      >
        {count}
      </span>
    </a>
  );
}

async function ListingsSection({
  geminiUsagePromise,
  appSettingsPromise,
  listingsPromise,
  unshippedOrdersPromise,
}: {
  appSettingsPromise: Promise<
    | {status: "success"; settings: AppSettings}
    | {status: "error"; message: string}
  >;
  geminiUsagePromise: Promise<GeminiUsageLoadResult>;
  listingsPromise: Promise<ListingsLoadResult>;
  unshippedOrdersPromise: Promise<UnshippedOrdersLoadResult>;
}) {
  const [listingsResult, unshippedOrdersResult, geminiUsageResult] =
    await Promise.all([
      listingsPromise,
      unshippedOrdersPromise,
      geminiUsagePromise,
    ]);
  const appSettingsResult = await appSettingsPromise;
  const ordersToShipCount =
    unshippedOrdersResult.status === "success"
      ? unshippedOrdersResult.count
      : 0;

  if (listingsResult.status === "error") {
    return (
      <>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
              Listings
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
              Inventory records
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrdersToShipIndicator count={ordersToShipCount} />
            <span className="rounded-full border border-rose-300/70 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              Request failed
            </span>
          </div>
        </div>

        <ListingsErrorState message={listingsResult.message} />
      </>
    );
  }

  const {listings} = listingsResult;

  return (
    <>
      {listings.length === 0 ? (
        <>
          <QueueErrorsPanelFallback />
          <ListingsEmptyState />
        </>
      ) : (
        <ListingsRealtime
          initialGeminiUsage={
            geminiUsageResult.status === "success"
              ? geminiUsageResult.geminiUsage
              : null
          }
          initialGeminiUsageStatus={
            geminiUsageResult.status === "success" ? "ready" : "error"
          }
          initialCaptureMode={
            appSettingsResult.status === "success"
              ? appSettingsResult.settings.capture_mode
              : null
          }
          initialListings={listings}
          panelErrorMessage={null}
          ordersToShipCount={ordersToShipCount}
          realtimeAnonKey={getListingsRealtimePublicKey()}
          realtimeUrl={getListingsRealtimePublicUrl()}
        />
      )}
    </>
  );
}

async function loadListings(): Promise<ListingsLoadResult> {
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

async function loadUnshippedOrders(): Promise<UnshippedOrdersLoadResult> {
  try {
    const orders = await listUnshippedOrders();

    return {
      count: countUnshippedOrders(orders),
      status: "success",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof SidecarApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not load unshipped orders.",
    };
  }
}

async function loadGeminiUsage(): Promise<GeminiUsageLoadResult> {
  try {
    return {
      geminiUsage: await getGeminiUsage(),
      status: "success",
    };
  } catch {
    return {
      status: "error",
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

async function AppSettingsSection({
  settingsPromise,
}: {
  settingsPromise: Promise<
    | {status: "success"; settings: AppSettings}
    | {status: "error"; message: string}
  >;
}) {
  const settingsResult = await settingsPromise;

  return (
    <section className="rounded-[2rem] border border-stone-950/10 bg-white/75 p-6 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur">
      <p className="text-xs font-bold tracking-[0.28em] text-stone-500">
        APP SETTINGS
      </p>
      {settingsResult.status === "success" ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <dl className="space-y-2">
            {[
              ["Capture mode: ", settingsResult.settings.capture_mode],
              ["Handling days: ", settingsResult.settings.handling_days],
              [
                "Shipping profile: ",
                settingsResult.settings.default_shipping_profile,
              ],
              ["Package type: ", settingsResult.settings.default_package_type],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center gap-2"
              >
                <dt className="text-sm text-stone-500">{label}</dt>
                <dd className="font-semibold">
                  {formatSettingValue(value)}
                </dd>
              </div>
            ))}
          </dl>
          <dl className="space-y-2">
            {[
              ["Placeholder 1: ", "—"],
              ["Placeholder 2: ", "—"],
              ["Placeholder 3: ", "—"],
              ["Placeholder 4: ", "—"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center gap-2"
              >
                <dt className="text-sm text-stone-500">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
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
      <QueueErrorsPanelFallback />
      <ListingsLoadingState />
    </>
  );
}

export default function Home() {
  const listingsPromise = loadListings();
  const unshippedOrdersPromise = loadUnshippedOrders();
  const geminiUsagePromise = loadGeminiUsage();
  const appSettingsPromise = loadAppSettings();
  return (
    <main className="app-scrollbar min-h-screen overflow-x-hidden bg-[#efe7d8] text-stone-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,_rgba(251,191,36,0.38),_transparent_28%),radial-gradient(circle_at_82%_18%,_rgba(20,184,166,0.22),_transparent_30%),linear-gradient(135deg,_rgba(68,64,60,0.08),_transparent_45%)]" />

      <section className="relative flex min-h-screen w-full flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
        <section className="rounded-[2rem] border border-stone-950/10 bg-white/80 p-5 shadow-[0_18px_60px_rgba(68,64,60,0.12)] backdrop-blur sm:p-7 min-h-[44rem]">
          <Suspense fallback={<ListingsSectionFallback />}>
          <ListingsSection
            appSettingsPromise={appSettingsPromise}
            geminiUsagePromise={geminiUsagePromise}
            listingsPromise={listingsPromise}
            unshippedOrdersPromise={unshippedOrdersPromise}
          />
          </Suspense>
        </section>

        <section className="grid gap-5">
          <Suspense fallback={<AppSettingsSectionFallback />}>
            <AppSettingsSection settingsPromise={appSettingsPromise} />
          </Suspense>
        </section>
      </section>
    </main>
  );
}
