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

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function isSucceeded(status: string): boolean {
  return status === "succeeded";
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
  research,
}: {
  research: ListingLatestPricingResearchSummary;
}) {
  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-amber-300 bg-amber-50/80 px-4 py-3">
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

function SucceededSummary({
  research,
}: {
  research: ListingLatestPricingResearchSummary;
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
