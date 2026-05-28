import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {retryPublishListingAction} from "@/app/listing-retry-publish-actions";
import {retryPublishListing} from "@/lib/sidecar-api/client";

const {
  fetchMock,
  getSidecarConfigMock,
  revalidatePathMock,
  retryPublishListingMock,
} = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getSidecarConfigMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  retryPublishListingMock: vi.fn(),
}));

vi.mock("@/lib/config/sidecar", () => ({
  getSidecarConfig: getSidecarConfigMock,
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
  retryPublishListing: retryPublishListingMock,
}));

describe("retryPublishListingAction", () => {
  beforeEach(() => {
    revalidatePathMock.mockReset();
    retryPublishListingMock.mockReset();
  });

  it("calls the retry API with listing_id", async () => {
    retryPublishListingMock.mockResolvedValueOnce({
      alreadyQueued: false,
      job: {id: "job-publish-retry"},
      listing: {listing_id: "LIST-001"},
      workflow: "publish",
    });

    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await retryPublishListingAction({error: null, success: null}, formData);

    expect(retryPublishListingMock).toHaveBeenCalledWith("LIST-001");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      error: null,
      success: "Retry publish queued for LIST-001.",
    });
  });

  it("returns the already queued message when publish is active", async () => {
    retryPublishListingMock.mockResolvedValueOnce({
      alreadyQueued: true,
      job: {id: "job-publish-active"},
      listing: {listing_id: "LIST-001"},
      workflow: "publish",
    });

    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await retryPublishListingAction({error: null, success: null}, formData);

    expect(result).toEqual({
      error: null,
      success: "Retry publish is already queued or running for LIST-001.",
    });
  });
});

describe("retryPublishListing", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
    getSidecarConfigMock.mockReturnValue({apiUrl: "http://sidecar.example"});
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the mounted retry path with an encoded listing id", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          alreadyQueued: false,
          job: {id: "job-publish-retry"},
          listing: {listing_id: "Single/000005"},
          workflow: "publish",
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    await retryPublishListing("Single/000005");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/listings/Single%2F000005/retry",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
      }),
    );
  });
});