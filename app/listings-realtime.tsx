"use client";

import {useEffect, useState} from "react";

import {ListingsTableEditable} from "@/app/listings-table-editable";
import {QueueErrorsPanel} from "@/app/queue-errors-panel";
import {PricingServiceToggle} from "@/app/pricing-service-toggle";
import type {GeminiDailyUsageSummary, Listing} from "@/lib/sidecar-api";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type GeminiUsageStatus = "error" | "ready";

type ListingsRealtimeProps = {
  initialCaptureMode?: string | null;
  initialGeminiUsage?: GeminiDailyUsageSummary | null;
  initialGeminiUsageStatus?: GeminiUsageStatus;
  initialPricingServiceEnabled?: boolean | null;
  initialListings: Listing[];
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
  const [captureMode, setCaptureMode] = useState(() =>
    initialCaptureMode === "lot_3_image" ? "lot_3_image" : "single_2_image",
  );

  useEffect(() => {
    if (!realtimeUrl || !realtimeAnonKey) {
      return;
    }

    const supabase = getSupabaseBrowserClient(realtimeUrl, realtimeAnonKey);
    let cancelled = false;
    let inFlight = false;
    let queuedRefresh = false;
    let timeoutId: number | null = null;
    let abortController: AbortController | null = null;
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
      abortController = new AbortController();

      try {
        const response = await fetch(refreshPath, {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          geminiUsage?: GeminiDailyUsageSummary | null;
          geminiUsageStatus?: GeminiUsageStatus;
          listings?: Listing[];
        };

        if (!cancelled && Array.isArray(payload.listings)) {
          setListings(payload.listings);
          setGeminiUsage(payload.geminiUsage ?? null);
          setGeminiUsageStatus(payload.geminiUsageStatus ?? "error");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      } finally {
        inFlight = false;
        abortController = null;

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
      abortController?.abort();

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      void supabase.removeChannel(channel);
    };
  }, [
    realtimeAnonKey,
    realtimeDebounceMs,
    realtimeSchema,
    realtimeTable,
    realtimeUrl,
    refreshPath,
  ]);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(18rem,0.82fr)]">
        <QueueErrorsPanel
          errorMessage={panelErrorMessage}
          geminiUsage={geminiUsage}
          geminiUsageStatus={geminiUsageStatus}
          listings={listings}
          ordersToShipCount={ordersToShipCount}
        />
        <section className="rounded-[1.75rem] border border-stone-950/10 bg-stone-50/85 p-5 shadow-[0_18px_48px_rgba(28,25,23,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-stone-500">
                Capture mode
              </p>
            </div>
          </div>

          <div
            role="radiogroup"
            aria-label="Capture mode"
            className="mt-4 grid grid-cols-2 gap-3"
          >
            {[
              {label: "Single", value: "single_2_image"},
              {label: "Lot", value: "lot_3_image"},
            ].map((option) => {
              const selected = captureMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCaptureMode(option.value)}
                  className={`inline-flex min-h-22 items-center justify-center rounded-[1.5rem] border px-4 py-4 text-2xl font-semibold transition ${
                    selected
                      ? "border-stone-950 bg-stone-950 text-stone-50 shadow-[0_12px_28px_rgba(28,25,23,0.2)]"
                      : "border-stone-950/10 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-950"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <PricingServiceToggle enabled={initialPricingServiceEnabled} />
          </div>
        </section>
      </div>
      <ListingsTableEditable listings={listings} />
    </>
  );
}
