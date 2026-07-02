import {cleanup, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {
  approveListingForExportMock,
  enqueueGenerateListingMock,
  retryListingPricingMock,
  retryPublishListingMock,
} = vi.hoisted(() => ({
  approveListingForExportMock: vi.fn(),
  enqueueGenerateListingMock: vi.fn(),
  retryListingPricingMock: vi.fn(),
  retryPublishListingMock: vi.fn(),
}));

vi.mock("@/app/listing-approve-export-actions", () => ({
  approveListingForExport: approveListingForExportMock,
}));

vi.mock("@/app/listing-generate-actions", () => ({
  enqueueGenerateListing: enqueueGenerateListingMock,
  retryListingPricing: retryListingPricingMock,
}));

vi.mock("@/app/listing-retry-publish-actions", () => ({
  retryPublishListingAction: retryPublishListingMock,
}));

import {ListingReviewGate} from "@/app/listing-status-controls";

function buildListing(overrides: Partial<Listing> = {}): Listing {
  return {
    approved_for_export_at: null,
    capture_mode: null,
    category_id: "CAT-1",
    condition_id: "COND-1",
    condition_notes: null,
    created_at: "2026-06-19T00:00:00.000Z",
    description: "Visible description",
    ebay_listing_id: null,
    ebay_listing_status: null,
    ebay_listing_url: null,
    ebay_offer_id: null,
    ese_eligible: null,
    estimated_weight_oz: null,
    exported_at: null,
    handling_days: null,
    id: "listing-row-id",
    image_urls: ["https://example.com/image.jpg"],
    item_specifics: {},
    last_error_at: null,
    last_error_code: null,
    listing_id: "LIST-001",
    listing_type: "single",
    merchant_location_key: null,
    package_type: null,
    price: 42,
    latest_pricing_research: {
      comp_summary: {
        rejected_comp_count: 0,
        rejected_comp_ids: [],
        selected_comp_count: 0,
        selected_comp_ids: [],
        total_comp_count: 0,
      },
      confidence: null,
      created_at: "2026-06-19T00:00:00.000Z",
      error_code: "research_price_suggested_price_invalid",
      error_message: "Suggested price did not pass validation.",
      listing_id: "LIST-001",
      llm_price_explanation: null,
      median_sold_price: null,
      pricing_model_name: null,
      provider: "soldcomps",
      query: "2023 Topps Chrome Mike Trout",
      research_id: "research-1",
      sold_count: null,
      status: "failed",
      suggested_price: null,
      updated_at: "2026-06-19T00:00:00.000Z",
    },
    r2_delete_after: null,
    r2_deleted_at: null,
    r2_object_keys: [],
    r2_retention_policy: null,
    seller_hints: null,
    shipping_profile: null,
    sku: null,
    sold_at: null,
    status: "needs_review",
    sub_status: "review_pending",
    title: "2023 Mike Trout Topps Chrome Rookie Card",
    updated_at: "2026-06-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("ListingReviewGate pricing retry", () => {
  beforeEach(() => {
    approveListingForExportMock.mockReset();
    enqueueGenerateListingMock.mockReset();
    retryListingPricingMock.mockReset();
    retryPublishListingMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Re-run Pricing for deterministic failed pricing research", () => {
    render(<ListingReviewGate listing={buildListing()} />);

    expect(
      screen.getByRole("button", {name: "Re-run Pricing"}),
    ).not.toBeNull();
    expect(screen.getByText(/Full pricing retry available/i)).not.toBeNull();
  });

  it("hides Re-run Pricing for succeeded, missing, and non-retryable research states", () => {
    const {rerender} = render(
      <ListingReviewGate
        listing={{
          ...buildListing(),
          latest_pricing_research: {
            ...buildListing().latest_pricing_research!,
            error_code: null,
            status: "succeeded",
            suggested_price: 42,
          },
        }}
      />,
    );

    expect(screen.queryByRole("button", {name: "Re-run Pricing"})).toBeNull();

    rerender(
      <ListingReviewGate listing={{...buildListing(), latest_pricing_research: null}} />,
    );
    expect(screen.queryByRole("button", {name: "Re-run Pricing"})).toBeNull();

    rerender(
      <ListingReviewGate
        listing={{
          ...buildListing(),
          latest_pricing_research: {
            ...buildListing().latest_pricing_research!,
            error_code: "provider_timeout",
          },
        }}
      />,
    );
    expect(screen.queryByRole("button", {name: "Re-run Pricing"})).toBeNull();
  });

  it("submits listing_id and shows queued feedback", async () => {
    retryListingPricingMock.mockResolvedValueOnce({
      error: null,
      info: null,
      success: "Queued pricing re-run for LIST-001. Listing now Needs review.",
    });
    const user = userEvent.setup();

    render(<ListingReviewGate listing={buildListing()} />);
    await user.click(screen.getByRole("button", {name: "Re-run Pricing"}));

    expect(retryListingPricingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(FormData),
    );
    const submittedFormData = retryListingPricingMock.mock.calls[0][1] as FormData;
    expect(submittedFormData.get("listing_id")).toBe("LIST-001");

    await waitFor(() => {
      expect(
        screen.getByText(
          "Queued pricing re-run for LIST-001. Listing now Needs review.",
        ),
      ).not.toBeNull();
    });
  });

  it("shows pricing retry errors", async () => {
    retryListingPricingMock.mockResolvedValueOnce({
      error: "Pricing provider unavailable.",
      info: null,
      success: null,
    });
    const user = userEvent.setup();

    render(<ListingReviewGate listing={buildListing()} />);
    await user.click(screen.getByRole("button", {name: "Re-run Pricing"}));

    await waitFor(() => {
      expect(
        screen.getByText("Pricing provider unavailable."),
      ).not.toBeNull();
    });
  });
});
