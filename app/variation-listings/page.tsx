import {QueueErrorsPanel} from "@/app/queue-errors-panel";
import {VariationListingsWorkspace} from "@/app/variation-listings/variation-listings-workspace";
import {
  SidecarApiError,
  getAppSettings,
  getGeminiUsage,
  listListings,
  listVariationListingGroups,
  type GeminiDailyUsageSummary,
  type Listing,
  type SoldCompsUsageSummary,
  type VariationListingGroup,
} from "@/lib/sidecar-api";
import {countUnshippedOrders, listUnshippedOrders} from "@/lib/unshipped-orders";

export const dynamic = "force-dynamic";

type VariationListingsLoadResult =
  | {status: "success"; groups: VariationListingGroup[]}
  | {status: "error"; message: string};

async function loadVariationListingGroups(): Promise<VariationListingsLoadResult> {
  try {
    return {
      status: "success",
      groups: await listVariationListingGroups(),
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof SidecarApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading variation listings.",
    };
  }
}

type StatusBarData = {
  geminiUsage: GeminiDailyUsageSummary | null;
  geminiUsageStatus: "error" | "ready";
  listings: Listing[];
  ordersToShipCount: number;
  soldCompsUsage: SoldCompsUsageSummary | null;
};

async function loadStatusBarData(): Promise<StatusBarData> {
  const [listingsResult, geminiResult, settingsResult, ordersResult] =
    await Promise.allSettled([
      listListings(),
      getGeminiUsage(),
      getAppSettings(),
      listUnshippedOrders(),
    ]);

  return {
    listings:
      listingsResult.status === "fulfilled" ? listingsResult.value : [],
    geminiUsage:
      geminiResult.status === "fulfilled" ? geminiResult.value : null,
    geminiUsageStatus:
      geminiResult.status === "fulfilled" ? "ready" : "error",
    soldCompsUsage:
      settingsResult.status === "fulfilled"
        ? settingsResult.value.soldcomps_usage
        : null,
    ordersToShipCount:
      ordersResult.status === "fulfilled"
        ? countUnshippedOrders(ordersResult.value)
        : 0,
  };
}

export default async function VariationListingsPage() {
  const [result, statusBar] = await Promise.all([
    loadVariationListingGroups(),
    loadStatusBarData(),
  ]);

  return (
    <main className="app-scrollbar min-h-screen overflow-x-hidden bg-[#e7dfd0] text-stone-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_10%,_rgba(251,191,36,0.28),_transparent_26%),radial-gradient(circle_at_84%_16%,_rgba(20,184,166,0.16),_transparent_28%),linear-gradient(135deg,_rgba(68,64,60,0.06),_transparent_46%)]" />
      <section className="relative min-h-screen w-full px-4 py-4 sm:px-6 sm:py-6">
        <div className="space-y-5">
          <QueueErrorsPanel
            currentWorkspace="variation"
            geminiUsage={statusBar.geminiUsage}
            geminiUsageStatus={statusBar.geminiUsageStatus}
            listings={statusBar.listings}
            ordersToShipCount={statusBar.ordersToShipCount}
            soldCompsUsage={statusBar.soldCompsUsage}
            statusOnly
          />
          {result.status === "success" ? (
            <VariationListingsWorkspace initialGroups={result.groups} />
          ) : (
            <section className="rounded-[1.75rem] border border-rose-300/70 bg-rose-50/90 p-6 shadow-[0_16px_42px_rgba(28,25,23,0.1)]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">
                Variation listings unavailable
              </p>
              <p className="mt-3 text-lg leading-8 text-rose-950">
                {result.message}
              </p>
              <a
                href="/"
                className="mt-5 inline-flex rounded-full border border-rose-900/20 bg-white px-4 py-2 text-sm font-semibold text-rose-950"
              >
                Return to standard listings
              </a>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
