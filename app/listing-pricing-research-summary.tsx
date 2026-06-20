"use client";

import type {ListingLatestPricingResearchSummary} from "@/lib/sidecar-api";

function formatPrice(price: number | null): string {
  if (price === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(price);
}

function formatCount(count: number): string {
  return new Intl.NumberFormat("en-US").format(count);
}

function isSucceeded(status: string): boolean {
  return status === "succeeded";
}

function FailedSummary({research}: {research: ListingLatestPricingResearchSummary}) {
  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-amber-300 bg-amber-50/80 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800">
          {research.status}
        </span>
        <span className="text-amber-700">
          Provider: {research.provider}
        </span>
      </div>
      {research.error_code ? (
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Error:</span> {research.error_code}
        </p>
      ) : null}
      {research.error_message ? (
        <p className="text-sm text-amber-800">
          {research.error_message}
        </p>
      ) : null}
      {research.query ? (
        <p className="text-xs text-amber-700">
          Query: {research.query}
        </p>
      ) : null}
    </div>
  );
}

function SucceededSummary({research}: {research: ListingLatestPricingResearchSummary}) {
  const hasExplanation =
    research.llm_price_explanation !== null &&
    research.llm_price_explanation.trim() !== "";

  return (
    <div className="mt-3 grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Suggested
          </span>
          <p className="mt-0.5 text-lg font-semibold tracking-[-0.02em] text-stone-900">
            {formatPrice(research.suggested_price)}
          </p>
        </div>

        {research.confidence ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
              research.confidence === "high"
                ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                : research.confidence === "medium"
                  ? "border border-amber-300 bg-amber-50 text-amber-800"
                  : "border border-rose-300 bg-rose-50 text-rose-800"
            }`}
          >
            {research.confidence} confidence
          </span>
        ) : null}

        {research.median_sold_price !== null ? (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Median sold
            </span>
            <p className="mt-0.5 text-sm font-medium text-stone-600">
              {formatPrice(research.median_sold_price)}
            </p>
          </div>
        ) : null}

        {research.sold_count !== null ? (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Sold count
            </span>
            <p className="mt-0.5 text-sm font-medium text-stone-600">
              {formatCount(research.sold_count)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-stone-500">
        <span>
          Selected:{" "}
          <span className="font-semibold text-stone-700">
            {formatCount(research.comp_summary.selected_comp_count)}
          </span>
        </span>
        <span>
          Rejected:{" "}
          <span className="font-semibold text-stone-700">
            {formatCount(research.comp_summary.rejected_comp_count)}
          </span>
        </span>
        <span>
          Total comps:{" "}
          <span className="font-semibold text-stone-700">
            {formatCount(research.comp_summary.total_comp_count)}
          </span>
        </span>
      </div>

      {research.query ? (
        <p className="text-xs text-stone-500">
          Query: {research.query}
        </p>
      ) : null}

      {hasExplanation ? (
        <p className="text-sm leading-6 text-stone-600">
          {research.llm_price_explanation}
        </p>
      ) : null}

      <p className="text-[10px] uppercase tracking-[0.1em] text-stone-400">
        Provider: {research.provider}
        {research.pricing_model_name
          ? ` · Model: ${research.pricing_model_name}`
          : ""}
      </p>
    </div>
  );
}

export function ListingPricingResearchSummary({
  research,
}: {
  research: ListingLatestPricingResearchSummary;
}) {
  if (isSucceeded(research.status)) {
    return <SucceededSummary research={research} />;
  }

  return <FailedSummary research={research} />;
}
