"use client";

import {useCallback, useEffect, useState} from "react";

import {savePricingProviderMode} from "@/app/pricing-provider-actions";
import {ListingsTableEditable} from "@/app/listings-table-editable";
import {QueueErrorsPanel} from "@/app/queue-errors-panel";
import {PricingServiceToggle} from "@/app/pricing-service-toggle";
import type {
  GeminiDailyUsageSummary,
  Listing,
  PricingProviderMode,
  SoldCompsUsageSummary,
} from "@/lib/sidecar-api";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type GeminiUsageStatus = "error" | "ready";

const captureModeOptions = [
  {label: "Single", value: "single_2_image"},
  {label: "Lot", value: "lot_3_image"},
] as const;

const pricingProviderOptions: Array<{
  label: string;
  value: PricingProviderMode;
}> = [
  {label: "Off", value: "off"},
  {label: "SoldComps", value: "soldcomps"},
  {label: "Apify", value: "apify"},
];

type ListingsRealtimeProps = {
  initialCaptureMode?: string | null;
  initialGeminiUsage?: GeminiDailyUsageSummary | null;
  initialGeminiUsageStatus?: GeminiUsageStatus;
  initialPricingServiceEnabled?: boolean | null;
  initialListings: Listing[];
  initialPricingProviderMode?: PricingProviderMode;
  initialSoldCompsUsage?: SoldCompsUsageSummary | null;
  ordersToShipCount?: number;
  panelErrorMessage?: string | null;
  realtimeAnonKey?: string | null;
  realtimeDebounceMs?: number;
  refreshPath?: string;
  realtimeSchema?: string;
  realtimeTable?: string;
  realtimeUrl?: string | null;
};

export function ListingsRealtime({
  initialCaptureMode = null,
  initialGeminiUsage = null,
  initialGeminiUsageStatus = "ready",
  initialPricingServiceEnabled = null,
  initialListings,
  initialPricingProviderMode = "off",
  initialSoldCompsUsage = null,
  ordersToShipCount = 0,
  panelErrorMessage = null,
  realtimeAnonKey = null,
  realtimeDebounceMs = 200,
  refreshPath = "/api/listings",
  realtimeSchema = "public",
  realtimeTable = "listings",
  realtimeUrl = null,
}: ListingsRealtimeProps) {
  const [listings, setListings] = useState(() => initialListings);
  const [geminiUsage, setGeminiUsage] = useState(() => initialGeminiUsage);
  const [geminiUsageStatus, setGeminiUsageStatus] = useState<GeminiUsageStatus>(
    () => initialGeminiUsageStatus,
  );
  const [soldCompsUsage, setSoldCompsUsage] = useState(
    () => initialSoldCompsUsage,
  );
  const [captureMode, setCaptureMode] = useState(() =>
    initialCaptureMode === "lot_3_image" ? "lot_3_image" : "single_2_image",
  );
  const [pricingProviderMode, setPricingProviderMode] =
    useState<PricingProviderMode>(() => initialPricingProviderMode);
  const [pricingProviderError, setPricingProviderError] = useState<
    string | null
  >(null);
  const [pricingProviderSaving, setPricingProviderSaving] = useState(false);

  const fetchAndSetListings = useCallback(async () => {
    try {
      const response = await fetch(refreshPath, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        geminiUsage?: GeminiDailyUsageSummary | null;
        geminiUsageStatus?: GeminiUsageStatus;
        listings?: Listing[];
        soldCompsUsage?: SoldCompsUsageSummary | null;
      };

      if (Array.isArray(payload.listings)) {
        setListings(payload.listings);
      }

      if ("geminiUsage" in payload) {
        setGeminiUsage(payload.geminiUsage ?? null);
      }

      if ("geminiUsageStatus" in payload) {
        setGeminiUsageStatus(payload.geminiUsageStatus ?? "error");
      }

      if ("soldCompsUsage" in payload) {
        setSoldCompsUsage(payload.soldCompsUsage ?? null);
      }
    } catch {
      // Swallow fetch errors — retry on next realtime event or manual action.
    }
  }, [refreshPath]);

  useEffect(() => {
    if (!realtimeUrl || !realtimeAnonKey) {
      return;
    }

    const supabase = getSupabaseBrowserClient(realtimeUrl, realtimeAnonKey);
    let cancelled = false;
    let inFlight = false;
    let queuedRefresh = false;
    let timeoutId: number | null = null;
    let hasRetriedAfterSubscribeFailure = false;

    async function refreshListings() {
      if (cancelled) {
        return;
      }

      if (inFlight) {
        queuedRefresh = true;
        return;
      }

      inFlight = true;

      try {
        await fetchAndSetListings();
      } finally {
        inFlight = false;

        if (queuedRefresh) {
          queuedRefresh = false;
          scheduleRefresh();
        }
      }
    }

    function scheduleRefresh() {
      if (cancelled) {
        return;
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        void refreshListings();
      }, realtimeDebounceMs);
    }

    const channel = supabase
      .channel(`listings-realtime:${realtimeSchema}:${realtimeTable}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: realtimeSchema,
          table: realtimeTable,
        },
        () => {
          scheduleRefresh();
        },
      )
      .subscribe((status) => {
        if (
          !hasRetriedAfterSubscribeFailure &&
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        ) {
          hasRetriedAfterSubscribeFailure = true;
          scheduleRefresh();
        }
      });

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      void supabase.removeChannel(channel);
    };
  }, [
    fetchAndSetListings,
    realtimeAnonKey,
    realtimeDebounceMs,
    realtimeSchema,
    realtimeTable,
    realtimeUrl,
  ]);

  async function handlePricingProviderChange(nextMode: PricingProviderMode) {
    if (pricingProviderSaving || nextMode === pricingProviderMode) {
      return;
    }

    const previousMode = pricingProviderMode;
    setPricingProviderMode(nextMode);
    setPricingProviderError(null);
    setPricingProviderSaving(true);

    const result = await savePricingProviderMode(nextMode);

    if (!result.success) {
      setPricingProviderMode(previousMode);
      setPricingProviderError(result.error);
    }

    setPricingProviderSaving(false);
  }

  const handleRetryComplete = useCallback(() => {
    void fetchAndSetListings();
  }, [fetchAndSetListings]);

  return (
    <>
      <div className="space-y-2">
        <QueueErrorsPanel
          errorMessage={panelErrorMessage}
          geminiUsage={geminiUsage}
          geminiUsageStatus={geminiUsageStatus}
          listings={listings}
          onRetryComplete={handleRetryComplete}
          ordersToShipCount={ordersToShipCount}
          soldCompsUsage={soldCompsUsage}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.85fr)_minmax(18rem,1.15fr)]">
          <section className="flex items-center rounded-2xl border border-stone-950/10 bg-stone-50/85 px-3 py-2 shadow-[0_10px_24px_rgba(28,25,23,0.08)]">
            <div
              role="radiogroup"
              aria-label="Capture mode"
              className="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center"
            >
              {captureModeOptions.map((option) => {
                const selected = captureMode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCaptureMode(option.value)}
                    className={`inline-flex min-h-9 flex-1 items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                      selected
                        ? "border-stone-950 bg-stone-950 text-stone-50 shadow-[0_8px_18px_rgba(28,25,23,0.14)]"
                        : "border-stone-950/10 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-950"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-950/10 bg-stone-50/85 px-3 py-2 shadow-[0_10px_24px_rgba(28,25,23,0.08)]">
            <div className="flex items-center gap-2">
              <div
                role="radiogroup"
                aria-label="Pricing provider"
                className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:flex sm:items-center"
              >
                {pricingProviderOptions.map((option) => {
                  const selected = pricingProviderMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-disabled={pricingProviderSaving}
                      disabled={pricingProviderSaving}
                      onClick={() =>
                        void handlePricingProviderChange(option.value)
                      }
                      className={`inline-flex min-h-9 flex-1 items-center justify-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                        selected
                          ? "border-stone-950 bg-stone-950 text-stone-50 shadow-[0_8px_18px_rgba(28,25,23,0.14)]"
                          : "border-stone-950/10 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-950"
                      } ${pricingProviderSaving ? "cursor-wait opacity-70" : ""}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {pricingProviderSaving ? (
                <span className="shrink-0 rounded-full bg-stone-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-600">
                  Saving
                </span>
              ) : null}
            </div>
            {pricingProviderError ? (
              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">
                {pricingProviderError}
              </p>
            ) : null}
            <div className="mt-3 border-t border-stone-950/10 pt-3">
              <PricingServiceToggle enabled={initialPricingServiceEnabled} />
            </div>
          </section>
        </div>
      </div>
      <ListingsTableEditable listings={listings} />
    </>
  );
}
