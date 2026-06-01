import type {Listing} from "@/lib/sidecar-api";
import Link from "next/link";
import {
  hasPersistedListingError,
  isNonEmptyString,
} from "@/app/listing-error-utils";

export type OperationalCounterKey = "errors" | "ready" | "review" | "active";

export type OperationalCounter = {
  key: OperationalCounterKey;
  label: string;
  count: number;
};

type QueueErrorsPanelProps = {
  errorMessage?: string | null;
  ordersToShipCount?: number;
  listings: Listing[];
};

type AiOperationalSummary = {
  attemptCount: number | null;
  failedLatestCount: number;
  runningLatestCount: number;
};

function isPublishedListing(status: Listing["status"] | string): boolean {
  const normalizedStatus = String(status);

  return normalizedStatus === "exported" || normalizedStatus === "listed";
}

function getPersistedErrorListings(listings: Listing[]): Listing[] {
  return listings.filter((listing) => hasPersistedListingError(listing));
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

function buildAiOperationalSummary(listings: Listing[]): AiOperationalSummary {
  let attemptCount: number | null = null;
  let failedLatestCount = 0;
  let runningLatestCount = 0;

  for (const listing of listings) {
    const summary = listing.ai_attempt_summary;

    if (!summary) {
      continue;
    }

    attemptCount = (attemptCount ?? 0) + summary.attempt_count;

    if (String(summary.latest_status) === "failed") {
      failedLatestCount += 1;
    }

    if (
      String(summary.latest_status) === "started" ||
      String(summary.latest_status) === "running"
    ) {
      runningLatestCount += 1;
    }
  }

  return {
    attemptCount,
    failedLatestCount,
    runningLatestCount,
  };
}

export function QueueErrorsPanel({
  errorMessage = null,
  ordersToShipCount = 0,
  listings,
}: QueueErrorsPanelProps) {
  const errorListings = getPersistedErrorListings(listings);
  const counters = buildOperationalCounters(listings);
  const aiSummary = buildAiOperationalSummary(listings);
  const aiSummaryLabel =
    aiSummary.attemptCount === null
      ? "AI Attempts: —"
      : aiSummary.attemptCount === 0
        ? "AI Attempts: 0"
        : aiSummary.failedLatestCount > 0
          ? `AI Attempts: ${aiSummary.attemptCount} · Failed: ${aiSummary.failedLatestCount}`
          : aiSummary.runningLatestCount > 0
            ? `AI Attempts: ${aiSummary.attemptCount} · Running: ${aiSummary.runningLatestCount}`
            : `AI Attempts: ${aiSummary.attemptCount}`;

  return (
    <section className="rounded-[1.75rem] border border-stone-950/10 bg-stone-950 p-4 text-stone-50 shadow-[0_18px_48px_rgba(28,25,23,0.22)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-stone-50">
          Operational summary
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-900/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-200 transition hover:border-stone-500 hover:text-stone-50"
          >
            <span>Orders to ship:</span>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-amber-950">
              {ordersToShipCount}
            </span>
          </Link>

          <div className="flex flex-wrap justify-end gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-stone-700 bg-stone-900/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-200">
              {aiSummaryLabel}
            </span>

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
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </p>
      ) : errorListings.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-stone-700 bg-stone-900/80 px-4 py-3 text-sm text-stone-300">
          No active queue or persisted errors.
        </p>
      ) : (
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
      )}
    </section>
  );
}

export function QueueErrorsPanelFallback() {
  return (
    <section className="rounded-[1.75rem] border border-stone-950/10 bg-stone-950 p-4 text-stone-50 shadow-[0_18px_48px_rgba(28,25,23,0.22)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-stone-50">
          Operational summary
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-6 w-36 animate-pulse rounded-full bg-stone-800/70" />
          <div className="flex flex-wrap justify-end gap-2">
            <div className="h-6 w-28 animate-pulse rounded-full bg-stone-800/70" />
            {Array.from({length: 4}).map((_, index) => (
              <div
                key={index}
                className="h-6 w-20 animate-pulse rounded-full bg-stone-800/70"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 h-16 animate-pulse rounded-2xl bg-stone-800/70" />
    </section>
  );
}
