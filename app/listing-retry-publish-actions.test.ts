import {beforeEach, describe, expect, it, vi} from "vitest";

import {retryPublishListingAction} from "@/app/listing-retry-publish-actions";

const {revalidatePathMock, retryPublishListingMock} = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  retryPublishListingMock: vi.fn(),
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