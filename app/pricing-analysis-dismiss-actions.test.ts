import {beforeEach, describe, expect, it, vi} from "vitest";

const {dismissPricingAnalysisWarningsMock} = vi.hoisted(() => ({
  dismissPricingAnalysisWarningsMock: vi.fn(),
}));

vi.mock("@/lib/sidecar-api", () => ({
  SidecarApiError: class SidecarApiError extends Error {
    response?: {error?: string; message?: string};
    status: number;

    constructor(
      message: string,
      status: number,
      response?: {error?: string; message?: string},
    ) {
      super(message);
      this.name = "SidecarApiError";
      this.status = status;
      this.response = response;
    }
  },
  dismissPricingAnalysisWarnings: dismissPricingAnalysisWarningsMock,
}));

import {dismissPricingAnalysisWarnings} from "@/app/pricing-analysis-dismiss-actions";
import type {Listing} from "@/lib/sidecar-api";

function buildListing(overrides: Partial<Listing> = {}): Listing {
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
    id: "row-id",
    image_urls: [],
    item_specifics: {},
    last_error_at: null,
    last_error_code: null,
    last_error_context: null,
    last_error_message: null,
    listing_id: "LIST-001",
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
    status: "assets_ready",
    sub_status: "idle",
    title: null,
    updated_at: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("dismissPricingAnalysisWarnings action", () => {
  beforeEach(() => {
    dismissPricingAnalysisWarningsMock.mockReset();
  });

  it("returns success with listing on successful dismiss", async () => {
    const listing = buildListing({listing_id: "LIST-001"});
    dismissPricingAnalysisWarningsMock.mockResolvedValue(listing);

    await expect(
      dismissPricingAnalysisWarnings("LIST-001", ["llm_analysis_failed"]),
    ).resolves.toEqual({
      error: null,
      listing,
      success: true,
    });
  });

  it("surfaces error message on API error", async () => {
    dismissPricingAnalysisWarningsMock.mockRejectedValue(
      new Error("Failed to dismiss warning."),
    );

    await expect(
      dismissPricingAnalysisWarnings("LIST-001", ["llm_analysis_failed"]),
    ).resolves.toEqual({
      error: "Failed to dismiss warning.",
      listing: null,
      success: false,
    });
  });

  it("surfaces network error message", async () => {
    dismissPricingAnalysisWarningsMock.mockRejectedValue(
      new Error("fetch failed"),
    );

    await expect(
      dismissPricingAnalysisWarnings("LIST-001", ["llm_analysis_failed"]),
    ).resolves.toEqual({
      error: "fetch failed",
      listing: null,
      success: false,
    });
  });
});
