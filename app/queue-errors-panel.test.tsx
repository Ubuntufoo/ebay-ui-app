import {cleanup, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

import type {GeminiDailyUsageSummary, Listing} from "@/lib/sidecar-api";
import {
  QueueErrorsPanel,
  buildOperationalCounters,
} from "@/app/queue-errors-panel";

function buildListing(
  listingId: string,
  status: Listing["status"] | "exported",
  subStatus: Listing["sub_status"] = "idle",
  overrides: Partial<Listing> = {},
): Listing {
  return {
    approved_for_export_at: null,
    capture_mode: null,
    category_id: null,
    condition_id: null,
    condition_notes: null,
    created_at: "2026-05-20T00:00:00.000Z",
    description: null,
    ebay_listing_id: null,
    ebay_listing_status: null,
    ebay_listing_url: null,
    ebay_offer_id: null,
    ese_eligible: null,
    estimated_weight_oz: null,
    exported_at: null,
    handling_days: null,
    id: `${listingId}-row-id`,
    image_urls: [],
    item_specifics: {},
    last_error_at: null,
    last_error_code: null,
    last_error_context: null,
    last_error_message: null,
    listing_id: listingId,
    listing_type: null,
    merchant_location_key: null,
    package_type: null,
    price: null,
    r2_delete_after: null,
    r2_deleted_at: null,
    r2_object_keys: [],
    r2_retention_policy: null,
    seller_hints: null,
    shipping_profile: null,
    sku: null,
    sold_at: null,
    status: status as Listing["status"],
    sub_status: subStatus,
    title: null,
    updated_at: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

function buildGeminiUsage(
  overrides: Partial<GeminiDailyUsageSummary> = {},
): GeminiDailyUsageSummary {
  return {
    effective_limit: 500,
    remaining: 479,
    reset_at: "2026-06-02T07:00:00.000Z",
    reset_time_zone: "America/Los_Angeles",
    usage_date: "2026-06-01",
    used: 21,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("buildOperationalCounters", () => {
  it("keeps only errors/ready/review/active and applies error precedence", () => {
    const counters = buildOperationalCounters([
      buildListing("LIST-READY", "assets_ready", "ready_to_generate", {
        last_error_context: {},
      }),
      buildListing("LIST-EXP-A", "exported" as Listing["status"], "idle"),
      buildListing("LIST-EXP-B", "listed", "active_live"),
      buildListing("LIST-ERR", "needs_review", "review_pending", {
        last_error_code: "publish_offer_failed",
      }),
    ]);

    expect(counters).toEqual([
      {key: "errors", label: "Errors", count: 1},
      {key: "ready", label: "Ready", count: 1},
      {key: "review", label: "Review", count: 0},
      {key: "active", label: "Active", count: 1},
    ]);
  });
});

describe("QueueErrorsPanel", () => {
  it("renders compact Gemini usage ratio and reset copy", () => {
    render(
      <QueueErrorsPanel
        geminiUsage={buildGeminiUsage()}
        listings={[buildListing("LIST-SUCCEEDED", "assets_ready", "ready_to_generate")]}
      />,
    );

    expect(screen.getByText("Gemini: 21 / 500 used")).not.toBeNull();
    expect(screen.getByText(/Resets /)).not.toBeNull();
    expect(screen.queryByText(/remaining/i)).toBeNull();
  });

  it("renders compact loading placeholders", () => {
    render(
      <QueueErrorsPanel
        geminiUsageStatus="loading"
        listings={[buildListing("LIST-LOADING", "assets_ready", "ready_to_generate")]}
      />,
    );

    expect(screen.queryByText(/Gemini:/)).toBeNull();
    expect(screen.queryByText(/remaining/i)).toBeNull();
  });

  it("renders compact unavailable state", () => {
    render(
      <QueueErrorsPanel
        geminiUsage={null}
        geminiUsageStatus="error"
        listings={[buildListing("LIST-ERR", "assets_ready", "ready_to_generate")]}
      />,
    );

    expect(screen.getByText("Gemini usage unavailable")).not.toBeNull();
  });

  it("shows near-limit warning without standalone remaining text", () => {
    render(
      <QueueErrorsPanel
        geminiUsage={buildGeminiUsage({effective_limit: 500, remaining: 20, used: 480})}
        listings={[buildListing("LIST-NEAR", "assets_ready", "ready_to_generate")]}
      />,
    );

    expect(screen.getByText("Gemini: 480 / 500 used")).not.toBeNull();
    expect(screen.getByText("Near limit")).not.toBeNull();
    expect(screen.queryByText(/20 remaining/i)).toBeNull();
  });

  it("renders reached state compactly", () => {
    render(
      <QueueErrorsPanel
        geminiUsage={buildGeminiUsage({remaining: 0, used: 500})}
        listings={[buildListing("LIST-LIMIT", "listed", "active_live")]}
      />,
    );

    expect(screen.getByText("Gemini limit reached")).not.toBeNull();
    expect(screen.getByText(/Resets /)).not.toBeNull();
  });

  it("removes publish/generating counters and normal-status bucket cards", () => {
    render(
      <QueueErrorsPanel
        ordersToShipCount={4}
        listings={[
          buildListing("LIST-READY", "assets_ready", "ready_to_generate"),
          buildListing("LIST-REV", "needs_review", "review_pending"),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", {name: "Orders to ship: 4"}),
    ).not.toBeNull();
    expect(screen.getByTestId("operational-counter-errors")).not.toBeNull();
    expect(screen.getByTestId("operational-counter-ready")).not.toBeNull();
    expect(screen.getByTestId("operational-counter-review")).not.toBeNull();
    expect(screen.getByTestId("operational-counter-active")).not.toBeNull();

    expect(screen.queryByText("Publish Queue")).toBeNull();
    expect(screen.queryByText("Generating")).toBeNull();
    expect(screen.queryByRole("heading", {name: "Ready for AI"})).toBeNull();
    expect(screen.queryByRole("heading", {name: "Needs Review"})).toBeNull();
    expect(
      screen.getByText("No active queue or persisted errors."),
    ).not.toBeNull();
  });

  it("renders only concise error rows for true persisted errors", () => {
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-ERR", "needs_review", "review_pending", {
            last_error_code: "publish_offer_failed",
            last_error_context: {category: "user_fixable"},
            last_error_message: "Offer creation failed after validation.",
          }),
        ]}
      />,
    );

    const errorsHeading = screen.getByRole("heading", {name: "Errors"});
    const errorsCard = errorsHeading.closest("section") as HTMLElement;

    expect(within(errorsCard).getAllByRole("listitem")).toHaveLength(1);
    expect(within(errorsCard).getByText(/LIST-ERR/)).not.toBeNull();
    expect(
      within(errorsCard).getByText(/needs_review \/ review_pending/),
    ).not.toBeNull();
    expect(
      within(errorsCard).getByText(/code publish_offer_failed/),
    ).not.toBeNull();
    expect(
      within(errorsCard).getByText(
        /message Offer creation failed after validation\./,
      ),
    ).not.toBeNull();
    expect(screen.queryByText("{}", {exact: false})).toBeNull();
    expect(screen.queryByText("user_fixable")).toBeNull();
  });

  it("shows compact empty state with assets_ready records and no true errors", () => {
    render(
      <QueueErrorsPanel
        ordersToShipCount={0}
        listings={[
          buildListing("LIST-READY", "assets_ready", "ready_to_generate", {
            last_error_context: {},
          }),
          buildListing("LIST-EXP", "exported" as Listing["status"], "idle"),
          buildListing("LIST-LISTED", "listed", "active_live"),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", {name: "Orders to ship: 0"}),
    ).not.toBeNull();
    expect(
      screen.getByText("No active queue or persisted errors."),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-errors")).getByText("0"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-ready")).getByText("1"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-review")).getByText("0"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-active")).getByText("1"),
    ).not.toBeNull();
  });

  it("excludes completed non-error listings but shows completed listings with persisted errors", () => {
    render(
      <QueueErrorsPanel
        ordersToShipCount={1}
        listings={[
          buildListing("LIST-EXP", "exported" as Listing["status"], "idle"),
          buildListing("LIST-LISTED", "listed", "active_live"),
          buildListing(
            "LIST-EXP-ERR",
            "exported" as Listing["status"],
            "idle",
            {
              last_error_code: "publish_offer_failed",
            },
          ),
        ]}
      />,
    );

    expect(screen.queryByText("LIST-EXP / exported / idle")).toBeNull();
    expect(screen.queryByText("LIST-LISTED / listed / active_live")).toBeNull();
    expect(
      screen.getByRole("link", {name: "Orders to ship: 1"}),
    ).not.toBeNull();
    expect(screen.getByText(/LIST-EXP-ERR \/ exported \/ idle/)).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-active")).getByText("0"),
    ).not.toBeNull();
  });

  it("updates counters and body when listings props are rerendered", () => {
    const {rerender} = render(
      <QueueErrorsPanel
        ordersToShipCount={2}
        listings={[
          buildListing("LIST-READY", "assets_ready", "ready_to_generate"),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", {name: "Orders to ship: 2"}),
    ).not.toBeNull();
    expect(
      screen.getByText("No active queue or persisted errors."),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-errors")).getByText("0"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-ready")).getByText("1"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-review")).getByText("0"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-active")).getByText("1"),
    ).not.toBeNull();

    rerender(
      <QueueErrorsPanel
        ordersToShipCount={5}
        listings={[
          buildListing("LIST-READY", "needs_review", "review_pending", {
            last_error_code: "r2_upload_failed",
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", {name: "Orders to ship: 5"}),
    ).not.toBeNull();
    expect(
      screen.queryByText("No active queue or persisted errors."),
    ).toBeNull();
    expect(
      screen.getByText(/LIST-READY \/ needs_review \/ review_pending/),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-errors")).getByText("1"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-ready")).getByText("0"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-review")).getByText("0"),
    ).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-active")).getByText("0"),
    ).not.toBeNull();
  });
});
