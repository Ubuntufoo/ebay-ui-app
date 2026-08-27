import {beforeEach, describe, expect, it, vi} from "vitest";

import {
  enqueueGenerateListing,
  retryListingPricing,
} from "@/app/listing-generate-actions";

const {
  enqueueGenerateAiMock,
  retryPricingMock,
  revalidatePathMock,
  updateListingMock,
} = vi.hoisted(() => ({
  enqueueGenerateAiMock: vi.fn(),
  retryPricingMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  updateListingMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/sidecar-api", () => ({
  SidecarApiError: class SidecarApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "SidecarApiError";
      this.status = status;
    }
  },
  enqueueGenerateAi: enqueueGenerateAiMock,
  retryPricing: retryPricingMock,
  updateListing: updateListingMock,
}));

describe("enqueueGenerateListing", () => {
  beforeEach(() => {
    enqueueGenerateAiMock.mockReset();
    retryPricingMock.mockReset();
    revalidatePathMock.mockReset();
    updateListingMock.mockReset();
  });

  it("queues generate_ai for a listing", async () => {
    enqueueGenerateAiMock.mockResolvedValueOnce({
      alreadyQueued: false,
      job: {id: "job-1"},
      listing: {
        status: "generating",
      },
    });
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("seller_hints", "  Use padded envelope  ");
    formData.set("auto_pricing_enabled", "true");
    formData.set("skip_browse", "false");
    formData.set("min_price_multiplier", "0.33");
    formData.set("max_price_multiplier", "3.00");

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(enqueueGenerateAiMock).toHaveBeenCalledWith("LIST-001", {
      autoPricingEnabled: true,
      sellerHints: "Use padded envelope",
    });
    expect(updateListingMock).toHaveBeenCalledWith("LIST-001", {
      browsePricingOptions: {
        skipBrowse: false,
        minPriceMultiplier: 0.33,
        maxPriceMultiplier: 3,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      error: null,
      info: null,
      success: "Queued Generate AI Draft for LIST-001. Listing now Generating.",
    });
  });

  it("forwards false for an unchecked auto-pricing checkbox", async () => {
    enqueueGenerateAiMock.mockResolvedValueOnce({
      alreadyQueued: false,
      job: {id: "job-1"},
      listing: {
        status: "generating",
      },
    });
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("seller_hints", "   ");

    await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(enqueueGenerateAiMock).toHaveBeenCalledWith("LIST-001", {
      autoPricingEnabled: false,
      sellerHints: null,
    });
  });

  it("persists modifier options before queueing generate", async () => {
    updateListingMock.mockResolvedValueOnce({});
    enqueueGenerateAiMock.mockResolvedValueOnce({
      alreadyQueued: false,
      job: {id: "job-1"},
      listing: {
        status: "generating",
      },
    });
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("exclude_graded", "false");
    formData.set("exclude_autographs", "true");
    formData.set("exclude_variants", "true");

    await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(updateListingMock).toHaveBeenCalledWith("LIST-001", {
      pricingModifierOptions: {
        excludeAutographs: true,
        excludeGraded: false,
        excludeVariants: true,
      },
    });
    expect(enqueueGenerateAiMock).toHaveBeenCalledWith("LIST-001", {
      autoPricingEnabled: false,
      sellerHints: null,
    });
  });

  it("persists complete Browse options and modifiers in one PATCH", async () => {
    updateListingMock.mockResolvedValueOnce({});
    enqueueGenerateAiMock.mockResolvedValueOnce({
      alreadyQueued: false,
      job: {id: "job-1"},
      listing: {
        status: "generating",
      },
    });
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("auto_pricing_enabled", "true");
    formData.set("skip_browse", "true");
    formData.set("min_price_multiplier", "0.5");
    formData.set("max_price_multiplier", "2");
    formData.set("exclude_graded", "false");
    formData.set("exclude_autographs", "true");
    formData.set("exclude_variants", "true");

    await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(updateListingMock).toHaveBeenCalledTimes(1);
    expect(updateListingMock).toHaveBeenCalledWith("LIST-001", {
      browsePricingOptions: {
        skipBrowse: true,
        minPriceMultiplier: 0.5,
        maxPriceMultiplier: 2,
      },
      pricingModifierOptions: {
        excludeAutographs: true,
        excludeGraded: false,
        excludeVariants: true,
      },
    });
    expect(enqueueGenerateAiMock).toHaveBeenCalledWith("LIST-001", {
      autoPricingEnabled: true,
      sellerHints: null,
    });
  });

  it.each([
    ["0", "3"],
    ["0.33", "0.33"],
    ["Infinity", "3"],
    ["0.33", "NaN"],
  ])("rejects invalid Browse multipliers %s/%s before queueing", async (min, max) => {
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("auto_pricing_enabled", "true");
    formData.set("skip_browse", "false");
    formData.set("min_price_multiplier", min);
    formData.set("max_price_multiplier", max);

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result.error).toContain("Browse multipliers");
    expect(updateListingMock).not.toHaveBeenCalled();
    expect(enqueueGenerateAiMock).not.toHaveBeenCalled();
  });

  it("does not validate or overwrite Browse options when Auto Pricing is off", async () => {
    enqueueGenerateAiMock.mockResolvedValueOnce({
      alreadyQueued: false,
      job: {id: "job-1"},
      listing: {
        status: "generating",
      },
    });
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("min_price_multiplier", "not-a-number");
    formData.set("max_price_multiplier", "0");

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result.error).toBeNull();
    expect(updateListingMock).not.toHaveBeenCalled();
    expect(enqueueGenerateAiMock).toHaveBeenCalledWith("LIST-001", {
      autoPricingEnabled: false,
      sellerHints: null,
    });
  });

  it("surfaces already queued as info", async () => {
    enqueueGenerateAiMock.mockResolvedValueOnce({
      alreadyQueued: true,
      job: {id: "job-1"},
      listing: {
        status: "generating",
      },
    });
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result).toEqual({
      error: null,
      info: "Generate AI Draft already queued or running for LIST-001. Listing now Generating.",
      success: null,
    });
  });

  it("rejects missing listing id", async () => {
    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      new FormData(),
    );

    expect(enqueueGenerateAiMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Listing ID is required.",
      info: null,
      success: null,
    });
  });

  it("surfaces enqueue failures", async () => {
    enqueueGenerateAiMock.mockRejectedValueOnce(new Error("queue failed"));
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result).toEqual({
      error: "queue failed",
      info: null,
      success: null,
    });
  });

  it("surfaces sidecar errors", async () => {
    const {SidecarApiError} = await import("@/lib/sidecar-api");
    enqueueGenerateAiMock.mockRejectedValueOnce(
      new SidecarApiError("Sidecar request failed with 409.", 409),
    );
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result).toEqual({
      error: "Sidecar request failed with 409.",
      info: null,
      success: null,
    });
  });
});

describe("retryListingPricing", () => {
  beforeEach(() => {
    retryPricingMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("queues a full pricing re-run for a listing", async () => {
    retryPricingMock.mockResolvedValueOnce({
      alreadyQueued: false,
      job: {id: "job-1"},
      listing: {
        status: "needs_review",
      },
      workflow: "research_price",
    });
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await retryListingPricing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(retryPricingMock).toHaveBeenCalledWith("LIST-001");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      error: null,
      info: null,
      success: "Queued pricing re-run for LIST-001. Listing now Needs review.",
    });
  });

  it("rejects missing listing id", async () => {
    const result = await retryListingPricing(
      {error: null, info: null, success: null},
      new FormData(),
    );

    expect(retryPricingMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Listing ID is required.",
      info: null,
      success: null,
    });
  });

  it("surfaces full pricing sidecar errors", async () => {
    const {SidecarApiError} = await import("@/lib/sidecar-api");
    retryPricingMock.mockRejectedValueOnce(
      new SidecarApiError("Sidecar request failed with 409.", 409),
    );
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await retryListingPricing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result).toEqual({
      error: "Sidecar request failed with 409.",
      info: null,
      success: null,
    });
  });

  it("surfaces unexpected full pricing retry errors", async () => {
    retryPricingMock.mockRejectedValueOnce(new Error("retry failed"));
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await retryListingPricing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result).toEqual({
      error: "retry failed",
      info: null,
      success: null,
    });
  });
});
