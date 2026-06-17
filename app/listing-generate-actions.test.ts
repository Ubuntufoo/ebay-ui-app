import {beforeEach, describe, expect, it, vi} from "vitest";

import {enqueueGenerateListing} from "@/app/listing-generate-actions";

const {enqueueGenerateAiMock, revalidatePathMock, updateListingMock} =
  vi.hoisted(() => ({
  enqueueGenerateAiMock: vi.fn(),
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
  updateListing: updateListingMock,
}));

describe("enqueueGenerateListing", () => {
  beforeEach(() => {
    enqueueGenerateAiMock.mockReset();
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

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(enqueueGenerateAiMock).toHaveBeenCalledWith("LIST-001", {
      sellerHints: "Use padded envelope",
    });
    expect(updateListingMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      error: null,
      info: null,
      success: "Queued Generate AI Draft for LIST-001. Listing now Generating.",
    });
  });

  it("sends null for empty seller hints", async () => {
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
