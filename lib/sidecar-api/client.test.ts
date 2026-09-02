import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const getSidecarConfigMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.fn();

vi.mock("@/lib/config/sidecar", () => ({
  getSidecarConfig: getSidecarConfigMock,
}));

import {
  abandonListing,
  configureVariationListingIntake,
  deleteSandboxListing,
  dismissPricingAnalysisWarnings,
  enqueueGenerateAi,
  getVariationListingIntakeSession,
  listVariationListingGroups,
  retryPricing,
  retryPricingAnalysis,
  updateAppSettings,
  updateListing,
} from "@/lib/sidecar-api/client";

describe("listVariationListingGroups", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the dedicated variation-listing group collection", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({groups: [{groupId: "group-1"}]}), {
        headers: {"content-type": "application/json"},
        status: 200,
      }),
    );

    const groups = await listVariationListingGroups();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/variation-listings",
      expect.objectContaining({
        cache: "no-store",
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer secret-token",
        }),
      }),
    );
    expect(groups).toEqual([{groupId: "group-1"}]);
  });
});

describe("variation listing intake session", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the canonical durable session", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({session: null}), {status: 200}));

    await expect(getVariationListingIntakeSession()).resolves.toEqual({session: null});
    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/variation-listings/intake-session",
      expect.objectContaining({method: "GET", cache: "no-store"}),
    );
  });

  it("patches only the fixed intake configuration fields", async () => {
    const session = {
      captureSourceKey: "camera-1",
      mode: "new_variation",
      targetGroupId: "group-1",
      targetVariationId: null,
      stickyPriceAmount: 1.49,
      stickyPriceCurrency: "USD",
      pendingPair: null,
      createdAt: "2026-09-02T15:00:00.000Z",
      updatedAt: "2026-09-02T15:01:00.000Z",
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({session}), {status: 200}));

    await expect(
      configureVariationListingIntake({
        mode: "new_variation",
        targetGroupId: "group-1",
        stickyPriceAmount: 1.49,
      }),
    ).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/variation-listings/intake-session",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          mode: "new_variation",
          targetGroupId: "group-1",
          stickyPriceAmount: 1.49,
        }),
      }),
    );
  });
});

describe("abandonListing", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts exact confirmation to the encoded abandonment endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({abandoned: true, listingId: "Single/000005"}),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    const result = await abandonListing("Single/000005");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/listings/Single%2F000005/abandon",
      expect.objectContaining({
        body: JSON.stringify({confirmed: true}),
        cache: "no-store",
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result).toEqual({abandoned: true, listingId: "Single/000005"});
  });
});

describe("deleteSandboxListing", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts exact stale-write confirmation to the encoded sandbox delete endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          deleted: true,
          listingId: "Single/000005",
          sku: "BSKBL-Single-000005",
          remoteOutcome: {
            deletedInventoryItem: true,
            deletedOfferCount: 1,
            endedListingCount: 1,
            missingResourceCount: 0,
            status: "deleted",
          },
          localOutcome: {
            databaseDeleted: true,
            r2ObjectCount: 2,
            status: "deleted",
            watcherDirectoryRemoved: true,
          },
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    const result = await deleteSandboxListing("Single/000005", {
      expectedSku: "BSKBL-Single-000005",
      expectedUpdatedAt: "2026-07-30T18:43:17.000Z",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/listings/Single%2F000005/delete-sandbox",
      expect.objectContaining({
        body: JSON.stringify({
          confirmed: true,
          expectedSku: "BSKBL-Single-000005",
          expectedUpdatedAt: "2026-07-30T18:43:17.000Z",
        }),
        cache: "no-store",
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result).toMatchObject({
      deleted: true,
      listingId: "Single/000005",
      sku: "BSKBL-Single-000005",
    });
  });
});

describe("enqueueGenerateAi", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts seller hints and the explicit auto-pricing preference", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          alreadyQueued: false,
          job: {id: "job-1"},
          listing: {listing_id: "Single/000005"},
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    await enqueueGenerateAi("Single/000005", {
      autoPricingEnabled: false,
      sellerHints: "Use padded envelope",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/listings/Single%2F000005/generate-ai",
      expect.objectContaining({
        body: JSON.stringify({
          sellerHints: "Use padded envelope",
          autoPricingEnabled: false,
        }),
        cache: "no-store",
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});

describe("sidecar app settings updates", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "token-123",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("patches pricing provider mode with camelCase payload", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          capture_mode: "single_2_image",
          default_fulfillment_policy_id: null,
          default_package_type: null,
          default_payment_policy_id: null,
          default_return_policy_id: null,
          default_shipping_profile: null,
          ebay_marketplace_id: null,
          gemini_daily_limit: null,
          handling_days: null,
          id: "settings-id",
          incoming_folder_path: null,
          max_order_syncs_per_day: null,
          merchant_location_key: null,
          office_location_name: null,
          pricing_provider_mode: "apify",
          pricing_service_enabled: true,
          processed_folder_path: null,
          r2_retention_days_after_sold: null,
          soldcomps_usage: null,
          updated_at: "2026-06-17T00:00:00.000Z",
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    const result = await updateAppSettings({pricingProviderMode: "apify"});

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/app-settings",
      expect.objectContaining({
        body: JSON.stringify({pricingProviderMode: "apify"}),
        cache: "no-store",
        method: "PATCH",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result.pricing_provider_mode).toBe("apify");
  });
});

describe("updateListing", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes browse pricing options while preserving existing patch fields", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({listing_id: "Single/000005"}), {
        headers: {"content-type": "application/json"},
        status: 200,
      }),
    );

    await updateListing("Single/000005", {
      categoryId: "CAT-1",
      conditionId: "COND-1",
      conditionNotes: "Minor corner wear",
      title: "Updated title",
      description: "Updated description",
      itemSpecifics: {brand: "Example"},
      price: 42,
      browsePricingOptions: {
        skipBrowse: true,
        minPriceMultiplier: 0.5,
        maxPriceMultiplier: 2,
      },
      pricingModifierOptions: {excludeGraded: true},
      sellerHints: "Use padded envelope",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/listings/Single%2F000005",
      expect.objectContaining({
        body: JSON.stringify({
          categoryId: "CAT-1",
          conditionId: "COND-1",
          conditionNotes: "Minor corner wear",
          description: "Updated description",
          itemSpecifics: {brand: "Example"},
          price: 42,
          browsePricingOptions: {
            skipBrowse: true,
            minPriceMultiplier: 0.5,
            maxPriceMultiplier: 2,
          },
          pricingModifierOptions: {excludeGraded: true},
          sellerHints: "Use padded envelope",
          title: "Updated title",
        }),
        cache: "no-store",
        method: "PATCH",
      }),
    );
  });
});

describe("retryPricingAnalysis", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to retry-pricing-analysis path with encoded listing id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({message: "Retry queued."}), {
        headers: {"content-type": "application/json"},
        status: 200,
      }),
    );

    await retryPricingAnalysis("Single/000005");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/listings/Single%2F000005/retry-pricing-analysis",
      expect.objectContaining({
        cache: "no-store",
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});

describe("retryPricing", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to retry-pricing path with encoded listing id", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          alreadyQueued: false,
          job: {id: "job-1"},
          listing: {listing_id: "Single/000005"},
          workflow: "research_price",
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    await retryPricing("Single/000005");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/listings/Single%2F000005/retry-pricing",
      expect.objectContaining({
        cache: "no-store",
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});

describe("dismissPricingAnalysisWarnings", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "secret-token",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to dismiss endpoint with codes in body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({listing: {listing_id: "LIST-001"}}), {
        headers: {"content-type": "application/json"},
        status: 200,
      }),
    );

    const result = await dismissPricingAnalysisWarnings("LIST-001", [
      "llm_analysis_failed",
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/listings/LIST-001/pricing-analysis-warnings/dismiss",
      expect.objectContaining({
        body: JSON.stringify({codes: ["llm_analysis_failed"]}),
        cache: "no-store",
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result).toEqual({listing_id: "LIST-001"});
  });
});
