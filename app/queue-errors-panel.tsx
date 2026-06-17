"use client";

import {useCallback, useState} from "react";
import type {
  GeminiDailyUsageSummary,
  Listing,
  SoldCompsUsageSummary,
} from "@/lib/sidecar-api";
import Link from "next/link";
import {
  hasPersistedListingError,
  isNonEmptyString,
} from "@/app/listing-error-utils";
import {
  retryPricingAnalysis,
  type RetryPricingAnalysisResult,
} from "@/app/pricing-analysis-retry-actions";

export type OperationalCounterKey = "errors" | "ready" | "review" | "active";

export type OperationalCounter = {
  key: OperationalCounterKey;
  label: string;
  count: number;
};

type QueueErrorsPanelProps = {
  errorMessage?: string | null;
  geminiUsage?: GeminiDailyUsageSummary | null;
  geminiUsageStatus?: "error" | "loading" | "ready";
  onRetryComplete?: (listingId: string) => void;
  ordersToShipCount?: number;
  listings: Listing[];
  retryAction?: (listingId: string) => Promise<RetryPricingAnalysisResult>;
  soldCompsUsage?: SoldCompsUsageSummary | null;
};

type GeminiUsagePresentation = {
  label: string;
  state: "error" | "near_limit" | "normal" | "reached";
};

type SoldCompsUsagePresentation = {
  label: string;
  state: "error" | "normal";
};

function isPublishedListing(status: Listing["status"] | string): boolean {
  const normalizedStatus = String(status);

  return normalizedStatus === "exported" || normalizedStatus === "listed";
}

function getPersistedErrorListings(listings: Listing[]): Listing[] {
  return listings.filter((listing) => hasPersistedListingError(listing));
}

function getPricingWarningListings(listings: Listing[]): Listing[] {
  return listings.filter(
    (listing) => (listing.pricing_analysis_warnings?.length ?? 0) > 0,
  );
}

function hasRetryableWarnings(listing: Listing): boolean {
  return (listing.pricing_analysis_warnings ?? []).some(
    (warning) => warning.retryable,
  );
}

export function buildOperationalCounters(
  listings: Listing[],
): OperationalCounter[] {
  let errors = 0;
  let ready = 0;
  let review = 0;
  let active = 0;

  for (const listing of listings) {
    const hasError = hasPersistedListingError(listing);

    if (hasError) {
      errors += 1;
      continue;
    }

    if (!isPublishedListing(listing.status)) {
      active += 1;
    }

    if (listing.status === "needs_review") {
      review += 1;
    }

    if (listing.status === "assets_ready") {
      ready += 1;
    }
  }

  return [
    {key: "errors", label: "Errors", count: errors},
    {key: "ready", label: "Ready", count: ready},
    {key: "review", label: "Review", count: review},
    {key: "active", label: "Active", count: active},
  ];
}

function formatGeminiModelLabel(
  geminiUsage: GeminiDailyUsageSummary | null,
): string | null {
  const lastAttempt = geminiUsage?.last_attempt;

  if (!lastAttempt) {
    return null;
  }

  if (isNonEmptyString(lastAttempt.model_name)) {
    return lastAttempt.model_name.trim();
  }

  if (isNonEmptyString(lastAttempt.display_name)) {
    return lastAttempt.display_name.trim();
  }

  return null;
}

function buildGeminiUsagePresentation(
  geminiUsage: GeminiDailyUsageSummary | null,
  geminiUsageStatus: "error" | "loading" | "ready",
): GeminiUsagePresentation {
  if (geminiUsageStatus === "error" || !geminiUsage) {
    return {
      label: "Gemini usage unavailable",
      state: "error",
    };
  }

  const modelLabel = formatGeminiModelLabel(geminiUsage);
  const baseLabel = `Gemini: ${geminiUsage.used}/${geminiUsage.effective_limit}`;
  const label = modelLabel ? `${baseLabel} <> Last: ${modelLabel}` : baseLabel;
  if (geminiUsage.remaining <= 0) {
    return {
      label,
      state: "reached",
    };
  }

  return {
    label,
    state: "normal",
  };
}

function buildSoldCompsUsagePresentation(
  soldCompsUsage: SoldCompsUsageSummary | null,
): SoldCompsUsagePresentation {
  if (
    !soldCompsUsage ||
    typeof soldCompsUsage.used !== "number" ||
    typeof soldCompsUsage.limit !== "number"
  ) {
    return {
      label: "SoldComps usage unavailable",
      state: "error",
    };
  }

  return {
    label: `SoldComps: ${soldCompsUsage.used}/${soldCompsUsage.limit}`,
    state: "normal",
  };
}

export function QueueErrorsPanel({
  errorMessage = null,
  geminiUsage = null,
  geminiUsageStatus = "ready",
  onRetryComplete,
  ordersToShipCount = 0,
  listings,
  retryAction = retryPricingAnalysis,
  soldCompsUsage = null,
}: QueueErrorsPanelProps) {
  const errorListings = getPersistedErrorListings(listings);
  const warningListings = getPricingWarningListings(listings);
  const counters = buildOperationalCounters(listings);
  const geminiUsagePresentation =
    geminiUsageStatus === "loading"
      ? null
      : buildGeminiUsagePresentation(geminiUsage, geminiUsageStatus);
  const soldCompsUsagePresentation =
    geminiUsageStatus === "loading"
      ? null
      : buildSoldCompsUsagePresentation(soldCompsUsage);

  const [retryingListingIds, setRetryingListingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [retryErrors, setRetryErrors] = useState<Map<string, string>>(
    () => new Map(),
  );

  const handleRetry = useCallback(
    async (listingId: string) => {
      if (retryingListingIds.has(listingId)) {
        return;
      }

      setRetryingListingIds((previous) => new Set(previous).add(listingId));
      setRetryErrors((previous) => {
        const next = new Map(previous);
        next.delete(listingId);
        return next;
      });

      const result = await retryAction(listingId);

      setRetryingListingIds((previous) => {
        const next = new Set(previous);
        next.delete(listingId);
        return next;
      });

      if (result.success) {
        onRetryComplete?.(listingId);
      } else if (result.error) {
        setRetryErrors((previous) => {
          const next = new Map(previous);
          next.set(listingId, result.error as string);
          return next;
        });
      }
    },
    [retryingListingIds, retryAction, onRetryComplete],
  );

  return (
    <section className="rounded-[1.75rem] border border-stone-950/10 bg-stone-950 p-4 text-stone-50 shadow-[0_18px_48px_rgba(28,25,23,0.22)] sm:p-5">
      <div className="flex flex-wrap justify-center items-center gap-4">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-900/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
        >
          <span>Orders to ship:</span>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-amber-950">
            {ordersToShipCount}
          </span>
        </Link>

        {geminiUsageStatus === "loading" ? (
          <>
            <div className="h-6 w-36 animate-pulse rounded-full bg-stone-800/70" />
            <div className="h-6 w-40 animate-pulse rounded-full bg-stone-800/70" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-stone-800/70" />
          </>
        ) : (
          <>
            <span
              className={`inline-flex max-w-full min-w-0 items-center rounded-full border px-3 py-1 text-[11px] tracking-[0.02em] sm:max-w-[24rem] ${
                geminiUsagePresentation?.state === "reached"
                  ? "border-rose-400/40 bg-rose-950/30 text-rose-100"
                  : geminiUsagePresentation?.state === "error"
                    ? "border-stone-700 bg-stone-900/70 text-stone-400"
                    : "border-stone-700 bg-stone-900/70 text-stone-200"
              }`}
            >
              <span className="truncate">{geminiUsagePresentation?.label}</span>
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-[0.02em] ${
                soldCompsUsagePresentation?.state === "error"
                  ? "border-stone-700 bg-stone-900/70 text-stone-400"
                  : "border-stone-700 bg-stone-900/70 text-stone-200"
              }`}
            >
              {soldCompsUsagePresentation?.label}
            </span>
          </>
        )}

        {counters.map((counter) => {
          const isErrorCounter = counter.key === "errors";

          return (
            <span
              key={counter.key}
              data-testid={`operational-counter-${counter.key}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
                isErrorCounter
                  ? "border-rose-400/40 bg-rose-950/30 text-rose-100"
                  : "border-stone-700 bg-stone-900/70 text-stone-200"
              }`}
            >
              {counter.label}
              <span
                className={`rounded-full px-2 py-0.5 ${
                  isErrorCounter
                    ? "bg-rose-200 text-rose-950"
                    : "bg-stone-100 text-stone-900"
                }`}
              >
                {counter.count}
              </span>
            </span>
          );
        })}
      </div>

      {warningListings.length > 0 && !errorMessage ? (
        <section className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-950/20 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">
              Pricing analysis warnings
            </h3>
            <span className="rounded-full bg-amber-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-950">
              {warningListings.length}
            </span>
          </div>

          <ol className="mt-3 list-decimal pl-5 text-sm leading-6 text-amber-100 marker:font-semibold marker:text-amber-200">
            {warningListings.map((listing, index) => {
              const warningParts = (
                listing.pricing_analysis_warnings ?? []
              ).map((warning) => {
                const modelSuffix = warning.model_name
                  ? ` [${warning.model_name}]`
                  : "";

                return `${warning.summary}${modelSuffix}`;
              });

              const isRetrying = retryingListingIds.has(listing.listing_id);
              const retryError = retryErrors.get(listing.listing_id);
              const showRetry = hasRetryableWarnings(listing);

              return (
                <li key={listing.id} className="pl-1 pb-3 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono font-semibold uppercase tracking-[0.12em]">
                      {listing.listing_id} · {warningParts.join(" · ")}
                    </span>
                    {showRetry ? (
                      <button
                        type="button"
                        disabled={isRetrying}
                        onClick={() => void handleRetry(listing.listing_id)}
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
                          isRetrying
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-300/60 cursor-wait"
                            : "border-amber-300/50 bg-amber-300/10 text-amber-100 hover:border-amber-200 hover:bg-amber-200/20 hover:text-amber-50"
                        }`}
                      >
                        {isRetrying ? "Retrying…" : "Retry pricing analysis"}
                      </button>
                    ) : null}
                  </div>
                  {retryError ? (
                    <p className="mt-1.5 text-xs text-amber-300/80">
                      {retryError}
                    </p>
                  ) : null}
                  {index < warningListings.length - 1 ? (
                    <hr className="mt-3 border-amber-300/50" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </p>
      ) : errorListings.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-950/30 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-rose-100">
              Errors
            </h3>
            <span className="rounded-full bg-rose-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-rose-950">
              {errorListings.length}
            </span>
          </div>

          <ol className="mt-3 list-decimal pl-5 text-sm leading-6 text-rose-100 marker:font-semibold marker:text-rose-200">
            {errorListings.map((listing, index) => {
              const errorParts = [
                `${listing.listing_id} / ${String(listing.status)} / ${String(listing.sub_status)}`,
              ];

              if (isNonEmptyString(listing.last_error_code)) {
                errorParts.push(`code ${listing.last_error_code.trim()}`);
              }

              if (isNonEmptyString(listing.last_error_message)) {
                errorParts.push(`message ${listing.last_error_message.trim()}`);
              }

              return (
                <li key={listing.id} className="pl-1 pb-3 last:pb-0">
                  <span className="font-mono font-semibold uppercase tracking-[0.12em]">
                    {errorParts.join(" · ")}
                  </span>
                  {index < errorListings.length - 1 ? (
                    <hr className="mt-3 border-rose-300/50" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </section>
  );
}

export function QueueErrorsPanelFallback() {
  return (
    <section className="rounded-[1.75rem] border border-stone-950/10 bg-stone-950 p-4 text-stone-50 shadow-[0_18px_48px_rgba(28,25,23,0.22)] sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-6 w-36 animate-pulse rounded-full bg-stone-800/70" />
        <div className="h-6 w-40 animate-pulse rounded-full bg-stone-800/70" />
        <div className="h-6 w-28 animate-pulse rounded-full bg-stone-800/70" />
        {Array.from({length: 4}).map((_, index) => (
          <div
            key={index}
            className="h-6 w-36 animate-pulse rounded-full bg-stone-800/70"
          />
        ))}
      </div>
      <div className="mt-4 h-16 animate-pulse rounded-2xl bg-stone-800/70" />
    </section>
  );
}
