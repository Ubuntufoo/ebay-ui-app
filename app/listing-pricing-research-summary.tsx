"use client";

import type {
  ListingLatestPricingResearchPriceAdjustment,
  ListingLatestPricingResearchSummary,
  ListingPriceAdjustmentConditionReason,
} from "@/lib/sidecar-api";

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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value)}%`;
}

function formatDiscountImpact(value: number): string {
  return formatSignedPercent(value === 0 ? 0 : -value);
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function isSucceeded(status: string): boolean {
  return status === "succeeded";
}

function getConditionReasonMessage(
  reason: ListingPriceAdjustmentConditionReason,
): string {
  switch (reason) {
    case "eligible":
      return "Condition adjustment applied from explicit comp conditions.";
    case "negative_blocked_for_top_condition":
      return "Negative condition adjustment blocked because the listing is Near Mint or Better.";
    case "listing_condition_unknown":
      return "Condition adjustment skipped because the listing condition is unknown.";
    case "median_price_unavailable":
      return "Condition adjustment skipped because the median sold price is unavailable.";
    case "insufficient_explicit_comp_conditions":
      return "Condition adjustment skipped because too few comps have explicit conditions.";
    case "comp_condition_median_unavailable":
      return "Condition adjustment skipped because the comp condition median is unavailable.";
    case "target_price_invalid":
      return "Condition adjustment skipped because the adjusted target price was invalid.";
  }
}

function PriceAdjustmentAudit({
  adjustment,
}: {
  adjustment: ListingLatestPricingResearchPriceAdjustment;
}) {
  const conditionParts = [
    adjustment.listing_condition_label,
    adjustment.listing_condition_score === null
      ? null
      : `Listing score ${formatNumber(adjustment.listing_condition_score)}`,
    adjustment.comp_median_condition_score === null
      ? null
      : `Comp median score ${formatNumber(adjustment.comp_median_condition_score)}`,
    `${formatCount(adjustment.explicit_comp_condition_count)} explicit condition ${
      adjustment.explicit_comp_condition_count === 1 ? "comp" : "comps"
    }`,
  ].filter((part): part is string => part !== null);
  const rawConditionPercent =
    adjustment.raw_condition_percent === null
      ? "Unavailable"
      : formatSignedPercent(adjustment.raw_condition_percent);
  const velocityTier =
    adjustment.sales_velocity_tier.charAt(0).toUpperCase() +
    adjustment.sales_velocity_tier.slice(1);

  return (
    <section
      aria-labelledby="price-modifiers-heading"
      className="grid gap-2 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-3 text-xs text-stone-600"
    >
      <h3
        id="price-modifiers-heading"
        className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-700"
      >
        Price modifiers
      </h3>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span>Median sold baseline</span>
        <span className="font-semibold text-stone-900">
          {formatPrice(adjustment.median_sold_price)}
        </span>
      </div>

      <div className="grid gap-1 border-t border-stone-200 pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span>Condition comparison</span>
          <span className="font-semibold text-stone-900">
            Raw {rawConditionPercent} · Applied{" "}
            {formatSignedPercent(adjustment.applied_condition_percent)}
          </span>
        </div>
        <p>{conditionParts.join(" · ")}</p>
        {adjustment.observed_condition_delta === null ? null : (
          <p>
            Observed score delta: {formatNumber(adjustment.observed_condition_delta)}
          </p>
        )}
        <p>{getConditionReasonMessage(adjustment.condition_reason)}</p>
        <p>
          Condition-adjusted price:{" "}
          <span className="font-semibold text-stone-900">
            {formatPrice(adjustment.condition_adjusted_price)}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-stone-200 pt-2">
        <span>Competitive discount</span>
        <span className="font-semibold text-stone-900">
          {formatDiscountImpact(adjustment.competitive_discount_percent)} ·{" "}
          {formatPrice(adjustment.competitive_adjusted_price)}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-stone-200 pt-2">
        <span>
          Sales velocity · {velocityTier} ·{" "}
          {formatCount(adjustment.recent_accepted_comp_count)} comps in{" "}
          {formatCount(adjustment.recent_window_days)} days
        </span>
        <span className="font-semibold text-stone-900">
          {formatDiscountImpact(adjustment.sales_velocity_discount_percent)}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-emerald-200 pt-2 text-emerald-800">
        <span className="font-semibold">Final total adjustment</span>
        <span className="font-bold">
          {formatSignedPercent(adjustment.final_total_adjustment_percent)} ·{" "}
          {formatPrice(adjustment.final_suggested_price)}
        </span>
      </div>
    </section>
  );
}

function FailureSummaryMessage({
  research,
}: {
  research: ListingLatestPricingResearchSummary;
}) {
  const failureSummary = research.failure_summary;
  const failureQuery = failureSummary?.query ?? research.query;
  const providerFailureStatus = failureSummary?.provider_failure_status?.trim();

  if (failureSummary?.reason === "provider_zero_results") {
    return (
      <>
        <p className="text-sm font-medium text-amber-800">
          Pricing research failed because the provider returned no matching sold
          comps. Enter or confirm the price manually, then continue review.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700">
          {failureQuery ? <span>Query: {failureQuery}</span> : null}
          {typeof failureSummary.requested_count === "number" ? (
            <span>
              Requested comps: {formatCount(failureSummary.requested_count)}
            </span>
          ) : null}
          {typeof failureSummary.provider_returned_count === "number" ? (
            <span>
              Provider returned:{" "}
              {formatCount(failureSummary.provider_returned_count)}
            </span>
          ) : null}
        </div>
      </>
    );
  }

  if (failureSummary?.reason === "all_comps_rejected") {
    const rejectedReasonCounts = failureSummary.rejected_reason_counts
      ? Object.entries(failureSummary.rejected_reason_counts)
      : [];

    return (
      <>
        <p className="text-sm font-medium text-amber-800">
          Pricing research failed because comps were found but backend
          validation rejected them all. Enter or confirm the price manually,
          then continue review.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700">
          {failureQuery ? <span>Query: {failureQuery}</span> : null}
          {typeof failureSummary.provider_returned_count === "number" ? (
            <span>
              Provider returned:{" "}
              {formatCount(failureSummary.provider_returned_count)}
            </span>
          ) : null}
          {typeof failureSummary.accepted_comp_count === "number" ? (
            <span>
              Accepted comps: {formatCount(failureSummary.accepted_comp_count)}
            </span>
          ) : null}
          {typeof failureSummary.rejected_comp_count === "number" ? (
            <span>
              Rejected comps: {formatCount(failureSummary.rejected_comp_count)}
            </span>
          ) : null}
        </div>
        {rejectedReasonCounts.length > 0 ? (
          <p className="text-xs text-amber-700">
            Rejected reasons:{" "}
            {rejectedReasonCounts
              .map(
                ([reason, count]) =>
                  `${formatLabel(reason)} (${formatCount(count)})`,
              )
              .join(", ")}
          </p>
        ) : null}
      </>
    );
  }

  if (failureSummary?.reason === "provider_failure") {
    return (
      <>
        <p className="text-sm font-medium text-amber-800">
          Pricing research failed because the provider call did not complete.
          Enter or confirm the price manually, then continue review.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700">
          {failureQuery ? <span>Query: {failureQuery}</span> : null}
          {failureSummary.provider_failure_code ? (
            <span>Failure code: {failureSummary.provider_failure_code}</span>
          ) : null}
          {failureSummary.provider_failure_category ? (
            <span>
              Failure category:{" "}
              {formatLabel(failureSummary.provider_failure_category)}
            </span>
          ) : null}
          {providerFailureStatus ? (
            <span>Failure status: {providerFailureStatus}</span>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-sm font-medium text-amber-800">
        Pricing research failed. Enter or confirm the price manually, then
        continue review.
      </p>
      {failureQuery ? (
        <p className="text-xs text-amber-700">Query: {failureQuery}</p>
      ) : null}
    </>
  );
}

function FailedSummary({
  className = "",
  research,
}: {
  className?: string;
  research: ListingLatestPricingResearchSummary;
}) {
  return (
    <div
      className={`grid gap-2 rounded-2xl border border-amber-300 bg-amber-50/80 px-4 py-3 ${className}`.trim()}
    >
      <FailureSummaryMessage research={research} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800">
          {research.status}
        </span>
        <span className="text-amber-700">Provider: {research.provider}</span>
      </div>
      {research.error_code ? (
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Error:</span> {research.error_code}
        </p>
      ) : null}
      {research.error_message ? (
        <p className="text-sm text-amber-800">{research.error_message}</p>
      ) : null}
    </div>
  );
}

function SucceededSummaryStats({
  research,
}: {
  research: ListingLatestPricingResearchSummary;
}) {
  return (
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
  );
}

function SucceededSummaryDetails({
  research,
  showPriceAdjustment = true,
}: {
  research: ListingLatestPricingResearchSummary;
  showPriceAdjustment?: boolean;
}) {
  const hasExplanation =
    research.llm_price_explanation !== null &&
    research.llm_price_explanation.trim() !== "";
  const acceptedCount =
    research.comp_summary.normalization_accepted_count ??
    research.comp_summary.total_comp_count;
  const rejectedCount =
    research.comp_summary.normalization_rejected_count ??
    research.comp_summary.rejected_comp_count;
  const providerReturnedCount = research.comp_summary.provider_returned_count;
  const providerReportedCount = research.comp_summary.provider_reported_count;
  const showProviderTotal =
    typeof providerReportedCount === "number" &&
    providerReportedCount !== providerReturnedCount;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-stone-500">
        <span>
          Accepted:{" "}
          <span className="font-semibold text-stone-700">
            {formatCount(acceptedCount)}
          </span>
        </span>
        <span>
          Rejected:{" "}
          <span className="font-semibold text-stone-700">
            {formatCount(rejectedCount)}
          </span>
        </span>
        {typeof providerReturnedCount === "number" ? (
          <span>
            Provider returned:{" "}
            <span className="font-semibold text-stone-700">
              {formatCount(providerReturnedCount)}
            </span>
          </span>
        ) : null}
        {showProviderTotal ? (
          <span>
            Provider total:{" "}
            <span className="font-semibold text-stone-700">
              {formatCount(providerReportedCount)}
            </span>
          </span>
        ) : null}
      </div>

      {research.query ? (
        <p className="text-xs text-stone-500">Query: {research.query}</p>
      ) : null}

      {hasExplanation ? (
        <p className="text-sm leading-6 text-stone-600">
          {research.llm_price_explanation}
        </p>
      ) : null}

      {showPriceAdjustment ? (
        <SucceededPriceAdjustment research={research} />
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

function SucceededPriceAdjustment({
  research,
}: {
  research: ListingLatestPricingResearchSummary;
}) {
  if (!isSucceeded(research.status) || research.price_adjustment === null) {
    return null;
  }

  return <PriceAdjustmentAudit adjustment={research.price_adjustment} />;
}

function SucceededSummary({
  className = "",
  research,
}: {
  className?: string;
  research: ListingLatestPricingResearchSummary;
}) {
  return (
    <div className={`grid gap-3 ${className}`.trim()}>
      <SucceededSummaryStats research={research} />
      <SucceededSummaryDetails research={research} />
    </div>
  );
}

export {
  SucceededPriceAdjustment,
  SucceededSummaryDetails,
  SucceededSummaryStats,
};

export function ListingPricingResearchSummary({
  className = "",
  research,
}: {
  className?: string;
  research: ListingLatestPricingResearchSummary;
}) {
  if (isSucceeded(research.status)) {
    return <SucceededSummary className={className} research={research} />;
  }

  return <FailedSummary className={className} research={research} />;
}
