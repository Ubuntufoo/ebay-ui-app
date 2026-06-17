import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import type {
  GeminiDailyUsageSummary,
  Listing,
  PricingAnalysisWarning,
  SoldCompsUsageSummary,
} from "@/lib/sidecar-api";
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
    pricing_analysis_warnings: [],
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
    last_attempt: null,
    remaining: 479,
    reset_at: "2026-06-02T07:00:00.000Z",
    reset_time_zone: "America/Los_Angeles",
    usage_date: "2026-06-01",
    used: 21,
    ...overrides,
  };
}

function buildSoldCompsUsage(
  overrides: Partial<SoldCompsUsageSummary> = {},
): SoldCompsUsageSummary {
  return {
    limit: 50,
    updatedAt: "2026-06-16T16:30:00.000Z",
    used: 43,
    ...overrides,
  };
}

function buildPricingWarning(
  overrides: Partial<PricingAnalysisWarning> = {},
): PricingAnalysisWarning {
  return {
    code: "pricing_fallback_used",
    listing_id: "LIST-WARN",
    model_name: "gemini-2.5-pro",
    retryable: true,
    severity: "warning",
    summary: "Sold comps returned no results; used AI fallback estimate.",
    ...overrides,
  };
}

function createRetryAction(
  behaviour: "resolve" | "reject" = "resolve",
  errorMessage?: string,
) {
  return vi.fn().mockImplementation(async () => {
    if (behaviour === "reject") {
      return {error: errorMessage ?? "Retry failed.", success: false};
    }

    return {error: null, success: true};
  });
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

  it("does not count pricing warnings as errors", () => {
    const counters = buildOperationalCounters([
      buildListing("LIST-WARN", "assets_ready", "ready_to_generate", {
        pricing_analysis_warnings: [
          buildPricingWarning({listing_id: "LIST-WARN"}),
        ],
      }),
    ]);

    expect(counters).toEqual([
      {key: "errors", label: "Errors", count: 0},
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
        listings={[
          buildListing("LIST-SUCCEEDED", "assets_ready", "ready_to_generate"),
        ]}
        soldCompsUsage={buildSoldCompsUsage()}
      />,
    );

    expect(screen.getByText("Gemini: 21/500")).not.toBeNull();
    expect(screen.getByText("SoldComps: 43/50")).not.toBeNull();
    expect(screen.queryByText(/remaining/i)).toBeNull();
  });

  it("renders latest Gemini model beside the compact usage counter", () => {
    render(
      <QueueErrorsPanel
        geminiUsage={buildGeminiUsage({
          last_attempt: {
            display_name: "Gemini 2.5 Pro",
            finished_at: "2026-06-01T13:00:00.000Z",
            model_name: "gemini-2.5-pro",
            provider: "gemini",
            started_at: "2026-06-01T12:59:00.000Z",
            status: "success",
          },
        })}
        listings={[
          buildListing("LIST-SUCCEEDED", "assets_ready", "ready_to_generate"),
        ]}
      />,
    );

    expect(screen.getByText(/Gemini: 21\/500/)?.textContent).toContain(
      "Last: gemini-2.5-pro",
    );
  });

  it("renders compact loading placeholders", () => {
    render(
      <QueueErrorsPanel
        geminiUsageStatus="loading"
        listings={[
          buildListing("LIST-LOADING", "assets_ready", "ready_to_generate"),
        ]}
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
        listings={[
          buildListing("LIST-ERR", "assets_ready", "ready_to_generate"),
        ]}
      />,
    );

    expect(screen.getByText("Gemini usage unavailable")).not.toBeNull();
    expect(screen.getByText("SoldComps usage unavailable")).not.toBeNull();
  });

  it("renders SoldComps unavailable state when used or limit missing", () => {
    render(
      <QueueErrorsPanel
        geminiUsage={buildGeminiUsage()}
        listings={[
          buildListing("LIST-SUCCEEDED", "assets_ready", "ready_to_generate"),
        ]}
        soldCompsUsage={buildSoldCompsUsage({used: null})}
      />,
    );

    expect(screen.getByText("SoldComps usage unavailable")).not.toBeNull();
  });

  it("shows near-limit warning without standalone remaining text", () => {
    render(
      <QueueErrorsPanel
        geminiUsage={buildGeminiUsage({
          effective_limit: 500,
          remaining: 20,
          used: 480,
        })}
        listings={[
          buildListing("LIST-NEAR", "assets_ready", "ready_to_generate"),
        ]}
      />,
    );

    expect(screen.getByText("Gemini: 480/500")).not.toBeNull();
    expect(screen.queryByText(/20 remaining/i)).toBeNull();
  });

  it("renders reached state compactly", () => {
    render(
      <QueueErrorsPanel
        geminiUsage={buildGeminiUsage({remaining: 0, used: 500})}
        listings={[buildListing("LIST-LIMIT", "listed", "active_live")]}
      />,
    );

    expect(screen.getByText("Gemini: 500/500")).not.toBeNull();
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
      screen.queryByText("No active queue or persisted errors."),
    ).toBeNull();
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
      screen.queryByText("No active queue or persisted errors."),
    ).toBeNull();
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
      screen.queryByText("No active queue or persisted errors."),
    ).toBeNull();
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

  it("renders pricing analysis warnings section with summary and listing id", () => {
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-WARN-1", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-WARN-1",
                summary:
                  "Sold comps returned no results; used AI fallback estimate.",
                model_name: "gemini-2.5-pro",
              }),
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText("Pricing analysis warnings")).not.toBeNull();
    expect(screen.getByText(/LIST-WARN-1/)).not.toBeNull();
    expect(
      screen.getByText(
        /Sold comps returned no results; used AI fallback estimate\./,
      ),
    ).not.toBeNull();
    expect(screen.getByText(/\[gemini-2.5-pro\]/)).not.toBeNull();
  });

  it("does not increment Errors counter for listings with warnings only", () => {
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-WARN", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({listing_id: "LIST-WARN"}),
            ],
          }),
        ]}
      />,
    );

    expect(
      within(screen.getByTestId("operational-counter-errors")).getByText("0"),
    ).not.toBeNull();
    expect(screen.getByText("Pricing analysis warnings")).not.toBeNull();
  });

  it("shows both warning and error sections when listing has both", () => {
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-BOTH", "needs_review", "review_pending", {
            last_error_code: "publish_offer_failed",
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-BOTH",
                summary: "AI fallback estimate confidence is low.",
              }),
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText("Pricing analysis warnings")).not.toBeNull();
    expect(screen.getByRole("heading", {name: "Errors"})).not.toBeNull();
    expect(
      within(screen.getByTestId("operational-counter-errors")).getByText("1"),
    ).not.toBeNull();
  });

  it("renders no warning section when pricing_analysis_warnings is empty", () => {
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-NONE", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [],
          }),
        ]}
      />,
    );

    expect(screen.queryByText("Pricing analysis warnings")).toBeNull();
  });

  it("renders retry button for retryable pricing warnings", () => {
    const retryAction = createRetryAction();
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-RETRY", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-RETRY",
                retryable: true,
              }),
            ],
          }),
        ]}
        retryAction={retryAction}
      />,
    );

    expect(screen.getByText("Retry pricing analysis")).not.toBeNull();
  });

  it("does not render retry button for non-retryable warnings", () => {
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-NONRETRY", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-NONRETRY",
                retryable: false,
              }),
            ],
          }),
        ]}
      />,
    );

    expect(
      screen.queryByText("Retry pricing analysis"),
    ).toBeNull();
  });

  it("shows loading state while retry is in progress", async () => {
    const retryAction = createRetryAction();
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-LOAD", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-LOAD",
                retryable: true,
              }),
            ],
          }),
        ]}
        retryAction={retryAction}
      />,
    );

    const button = screen.getByText("Retry pricing analysis");
    fireEvent.click(button);

    expect(screen.getByText("Retrying…")).not.toBeNull();
    expect(button).toHaveProperty("disabled", true);

    await vi.waitFor(() => {
      expect(retryAction).toHaveBeenCalledWith("LIST-LOAD");
    });
  });

  it("shows error message on retry failure", async () => {
    const retryAction = createRetryAction(
      "reject",
      "Rate limit exceeded for pricing provider.",
    );
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-FAIL", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-FAIL",
                retryable: true,
              }),
            ],
          }),
        ]}
        retryAction={retryAction}
      />,
    );

    fireEvent.click(screen.getByText("Retry pricing analysis"));

    await vi.waitFor(() => {
      expect(
        screen.getByText("Rate limit exceeded for pricing provider."),
      ).not.toBeNull();
    });
  });

  it("prevents concurrent retries for the same listing", async () => {
    const retryAction = createRetryAction();
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-DEDUP", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-DEDUP",
                retryable: true,
              }),
            ],
          }),
        ]}
        retryAction={retryAction}
      />,
    );

    const button = screen.getByText("Retry pricing analysis");
    fireEvent.click(button);
    fireEvent.click(button);

    expect(retryAction).toHaveBeenCalledTimes(1);
  });

  it("calls onRetryComplete after successful retry", async () => {
    const retryAction = createRetryAction();
    const onRetryComplete = vi.fn();
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-CB", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-CB",
                retryable: true,
              }),
            ],
          }),
        ]}
        onRetryComplete={onRetryComplete}
        retryAction={retryAction}
      />,
    );

    fireEvent.click(screen.getByText("Retry pricing analysis"));

    await vi.waitFor(() => {
      expect(onRetryComplete).toHaveBeenCalledWith("LIST-CB");
    });
  });

  it("shows default unavailable message when no retryAction is provided", async () => {
    render(
      <QueueErrorsPanel
        listings={[
          buildListing("LIST-UNAVAIL", "assets_ready", "ready_to_generate", {
            pricing_analysis_warnings: [
              buildPricingWarning({
                listing_id: "LIST-UNAVAIL",
                retryable: true,
              }),
            ],
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByText("Retry pricing analysis"));

    await vi.waitFor(() => {
      expect(
        screen.getByText("Pricing analysis retry is not available yet."),
      ).not.toBeNull();
    });
  });
});
