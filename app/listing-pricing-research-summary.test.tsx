import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

import {ListingPricingResearchSummary} from "@/app/listing-pricing-research-summary";
import type {
  ListingLatestPricingResearchActiveMarket,
  ListingActiveMarketCompetitor,
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
  activeMarket?: ListingLatestPricingResearchActiveMarket,
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
    ...(activeMarket ? {active_market: activeMarket} : {}),
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
    terapeak_max_price: null,
    terapeak_min_price: null,
    updated_at: "2026-07-28T20:00:00.000Z",
  };
}

const firstCompetitor: ListingActiveMarketCompetitor = {
  legacy_item_id: "active-1",
  title: "First active listing",
  condition: "Ungraded",
  condition_id: "4000",
  item_price: {value: 39.99, currency: "USD"},
  shipping_cost: {value: 4.99, currency: "USD"},
  shipping_type: "FIXED",
  total_price: {value: 44.98, currency: "USD"},
  item_url: "https://www.ebay.com/itm/active-1",
};

const secondCompetitor: ListingActiveMarketCompetitor = {
  legacy_item_id: "active-2",
  title: "Second active listing",
  condition: null,
  condition_id: null,
  item_price: {value: 42, currency: "USD"},
  shipping_cost: null,
  shipping_type: null,
  total_price: null,
  item_url: "https://www.ebay.com/itm/active-2",
};

function buildActiveMarket(
  overrides: Partial<ListingLatestPricingResearchActiveMarket> = {},
): ListingLatestPricingResearchActiveMarket {
  return {
    status: "available",
    skip_reason: null,
    unavailable_reason: null,
    incomplete_reason: null,
    captured_at: "2026-08-25T15:00:00.000Z",
    anchor: {
      value: 42,
      currency: "USD",
      basis: "condition_adjusted_base_price_before_competitive_velocity",
    },
    multipliers: {min_price_multiplier: 0.33, max_price_multiplier: 3},
    item_price_window: {min: 13.86, max: 126, currency: "USD"},
    query: {
      canonical: "2023 Topps Chrome Mike Trout",
      marketplace_id: "EBAY_US",
      category_id: "261328",
      condition_id: "4000",
      buying_option: "FIXED_PRICE",
    },
    seller_exclusion_applied: true,
    shipping_context: {country: "US", postal_code: "19406", basis: "configured_contextual_location"},
    safeguards: {max_pages: 10, max_duration_ms: 15_000, max_offset: 2_000},
    pages_scanned: 1,
    candidate_rows_scanned: 2,
    complete: true,
    exact_accepted_count: 2,
    accepted_count: 2,
    rejected_count: 0,
    rejection_reason_counts: {},
    distributions: {
      item_price: {low: 39.99, median: 40.995, high: 42, currency: "USD"},
      shipping_known_total: {low: 44.98, median: 44.98, high: 44.98, currency: "USD"},
    },
    shipping_known_accepted_count: 1,
    latency_ms: 100,
    tactical_sell_price: 39.95,
    competitors: [firstCompetitor, secondCompetitor],
    ...overrides,
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

  it("renders separate Suggested and Tactical values with Browse range help", () => {
    render(
      <ListingPricingResearchSummary
        research={buildResearch(null, buildActiveMarket())}
      />,
    );

    expect(screen.getByText("$42.00")).not.toBeNull();
    expect(screen.getByText("$39.95")).not.toBeNull();
    expect(screen.getByText("Suggested").getAttribute("title")).toBe(
      "Suggested is the normal sold-comps and condition result.",
    );
    expect(screen.getByText("Tactical sell price").getAttribute("title")).toBe(
      "Tactical is supplemental current fixed-price competition evidence. It never automatically replaces Suggested and appears only when backend evidence gates pass.",
    );
    expect(screen.getByText("$13.86 – $126.00")).not.toBeNull();
    expect(screen.getByText(/Browse multipliers: 0.33× min · 3× max/)).not.toBeNull();
    expect(
      screen.getByText(
        /condition-aware anchor before competitive and velocity adjustments; eBay filters item price, while shipping is evaluated separately/i,
      ),
    ).not.toBeNull();
  });

  it("renders null Tactical as unavailable without treating it as zero", () => {
    render(
      <ListingPricingResearchSummary
        research={buildResearch(null, buildActiveMarket({tactical_sell_price: null}))}
      />,
    );

    expect(screen.getByText("Tactical sell price")).not.toBeNull();
    expect(screen.getByText("Unavailable — not enough exact evidence")).not.toBeNull();
    expect(screen.queryByText("$0.00")).toBeNull();
  });

  it("renders incomplete, skipped, and unavailable active-market states safely", () => {
    const {rerender} = render(
      <ListingPricingResearchSummary
        research={buildResearch(
          null,
          buildActiveMarket({
            complete: false,
            incomplete_reason: "page_limit",
            exact_accepted_count: null,
            tactical_sell_price: null,
          }),
        )}
      />,
    );
    expect(screen.getByText("Incomplete")).not.toBeNull();
    expect(screen.getByText("Incomplete: page limit")).not.toBeNull();

    rerender(
      <ListingPricingResearchSummary
        research={buildResearch(
          null,
          buildActiveMarket({
            status: "skipped",
            skip_reason: "browse_disabled",
            complete: false,
            item_price_window: null,
            incomplete_reason: null,
            exact_accepted_count: null,
            competitors: [],
            tactical_sell_price: null,
          }),
        )}
      />,
    );
    expect(screen.getByText("Skipped")).not.toBeNull();
    expect(screen.getByText("Reason: browse disabled")).not.toBeNull();

    rerender(
      <ListingPricingResearchSummary
        research={buildResearch(
          null,
          buildActiveMarket({
            status: "unavailable",
            unavailable_reason: "api_failed",
            complete: false,
            item_price_window: null,
            incomplete_reason: null,
            exact_accepted_count: null,
            competitors: [],
            tactical_sell_price: null,
          }),
        )}
      />
    );
    expect(screen.getByText("Unavailable", {exact: true})).not.toBeNull();
    expect(screen.getByText("Reason: api failed")).not.toBeNull();
  });

  it("keeps competitor order and marks missing shipping and totals unavailable", () => {
    render(
      <ListingPricingResearchSummary
        research={buildResearch(null, buildActiveMarket())}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "First active listing",
      "Second active listing",
    ]);
    expect(links[0]?.getAttribute("href")).toBe(firstCompetitor.item_url);
    expect(links[1]?.getAttribute("href")).toBe(secondCompetitor.item_url);
    expect(screen.getByText("Condition: Unknown")).not.toBeNull();
    expect(screen.getAllByText("Shipping: Unavailable")).toHaveLength(1);
    expect(screen.getAllByText("Total: Unavailable")).toHaveLength(1);
    expect(screen.getAllByText(/Captured: 2026-08-25T15:00:00.000Z/)).toHaveLength(1);
  });
});
