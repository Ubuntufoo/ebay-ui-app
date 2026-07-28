import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

import {ListingPricingResearchSummary} from "@/app/listing-pricing-research-summary";
import type {
  ListingLatestPricingResearchPriceAdjustment,
  ListingLatestPricingResearchSummary,
} from "@/lib/sidecar-api";

const blockedTopConditionAdjustment: ListingLatestPricingResearchPriceAdjustment = {
  applied_condition_percent: 0,
  comp_median_condition_score: 5.5,
  competitive_adjusted_price: 111.7485,
  competitive_discount_percent: 5,
  condition_adjusted_price: 117.63,
  condition_reason: "negative_blocked_for_top_condition",
  explicit_comp_condition_count: 8,
  final_suggested_price: 111.75,
  final_total_adjustment_percent: -5,
  listing_condition_label: "Near Mint or Better",
  listing_condition_score: 5,
  median_sold_price: 117.63,
  observed_condition_delta: -0.5,
  raw_condition_percent: -12.25,
  recent_accepted_comp_count: 8,
  recent_window_days: 90,
  sales_velocity_discount_percent: 0,
  sales_velocity_tier: "high",
};

function buildResearch(
  priceAdjustment: ListingLatestPricingResearchPriceAdjustment | null,
): ListingLatestPricingResearchSummary {
  return {
    comp_summary: {
      normalization_accepted_count: 8,
      normalization_rejected_count: 2,
      rejected_comp_count: 2,
      rejected_comp_ids: ["comp-9", "comp-10"],
      selected_comp_count: 8,
      selected_comp_ids: [
        "comp-1",
        "comp-2",
        "comp-3",
        "comp-4",
        "comp-5",
        "comp-6",
        "comp-7",
        "comp-8",
      ],
      total_comp_count: 10,
    },
    confidence: "high",
    created_at: "2026-07-28T20:00:00.000Z",
    error_code: null,
    error_message: null,
    listing_id: "LIST-001",
    llm_price_explanation: "Strong recent comps support this price.",
    median_sold_price: 45,
    pricing_model_name: "gemini-3.5-flash-lite",
    price_adjustment: priceAdjustment,
    provider: "soldcomps",
    query: "2023 Topps Chrome Mike Trout",
    research_id: "research-1",
    sold_count: 8,
    status: "succeeded",
    suggested_price: 42,
    updated_at: "2026-07-28T20:00:00.000Z",
  };
}

describe("ListingPricingResearchSummary price modifiers", () => {
  afterEach(() => {
    cleanup();
  });

  it("distinguishes a blocked raw top-condition adjustment from the applied adjustment", () => {
    render(
      <ListingPricingResearchSummary
        research={buildResearch(blockedTopConditionAdjustment)}
      />,
    );

    const baselineRow = screen.getByText("Median sold baseline").parentElement;
    expect(baselineRow?.textContent).toContain("$117.63");
    expect(screen.getByText("Raw -12.25% · Applied 0%")).not.toBeNull();
    expect(
      screen.getByText(
        "Negative condition adjustment blocked because the listing is Near Mint or Better.",
      ),
    ).not.toBeNull();

    const competitiveRow = screen.getByText("Competitive discount").parentElement;
    expect(competitiveRow?.textContent).toContain("-5% · $111.75");

    const velocityRow = screen.getByText(/Sales velocity · High/).parentElement;
    expect(velocityRow?.textContent).toContain("8 comps in 90 days");
    expect(velocityRow?.textContent).toContain("0%");

    const finalRow = screen.getByText("Final total adjustment").parentElement;
    expect(finalRow?.textContent).toContain("-5% · $111.75");
  });

  it("keeps legacy succeeded research unchanged when the audit is null", () => {
    render(<ListingPricingResearchSummary research={buildResearch(null)} />);

    expect(screen.getByText("$42.00")).not.toBeNull();
    expect(screen.getByText("$45.00")).not.toBeNull();
    expect(
      screen.getByText("Strong recent comps support this price."),
    ).not.toBeNull();
    expect(
      screen.queryByRole("heading", {name: "Price modifiers"}),
    ).toBeNull();
  });

  it("shows a positive applied condition adjustment without a blocked message", () => {
    render(
      <ListingPricingResearchSummary
        research={buildResearch({
          ...blockedTopConditionAdjustment,
          applied_condition_percent: 8.5,
          condition_adjusted_price: 127.63,
          condition_reason: "eligible",
          raw_condition_percent: 8.5,
        })}
      />,
    );

    expect(screen.getByText("Raw +8.5% · Applied +8.5%")).not.toBeNull();
    expect(
      screen.getByText(
        "Condition adjustment applied from explicit comp conditions.",
      ),
    ).not.toBeNull();
    expect(
      screen.queryByText(/blocked because the listing is Near Mint or Better/i),
    ).toBeNull();
  });
});
