import {beforeEach, describe, expect, it, vi} from "vitest";

import {abandonListingAction} from "@/app/listing-abandon-actions";
import {initialAbandonListingActionState} from "@/app/listing-abandon-state";

const {abandonListingMock, revalidatePathMock} = vi.hoisted(() => ({
  abandonListingMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/sidecar-api", () => {
  class SidecarApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly response?: {error?: string; message?: string},
    ) {
      super(message);
      this.name = "SidecarApiError";
    }
  }

  return {
    abandonListing: abandonListingMock,
    SidecarApiError,
  };
});

describe("abandonListingAction", () => {
  beforeEach(() => {
    abandonListingMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("validates listing ID before calling the sidecar", async () => {
    const result = await abandonListingAction(
      initialAbandonListingActionState,
      new FormData(),
    );

    expect(abandonListingMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      abandonedListingId: null,
      error: "Listing ID is required.",
      success: null,
    });
  });

  it("abandons the listing and revalidates the dashboard", async () => {
    abandonListingMock.mockResolvedValueOnce({
      abandoned: true,
      listingId: "LIST-001",
    });
    const formData = new FormData();
    formData.set("listing_id", " LIST-001 ");

    const result = await abandonListingAction(
      initialAbandonListingActionState,
      formData,
    );

    expect(abandonListingMock).toHaveBeenCalledWith("LIST-001");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      abandonedListingId: "LIST-001",
      error: null,
      success: "Abandoned LIST-001.",
    });
  });

  it("returns the backend response message without revalidating", async () => {
    const {SidecarApiError} = await import("@/lib/sidecar-api");
    abandonListingMock.mockRejectedValueOnce(
      new SidecarApiError(
        "Sidecar request failed with 409.",
        409,
        {
          error: "listing_not_abandonable",
          message: "Listing changed and can no longer be abandoned.",
        },
      ),
    );
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await abandonListingAction(
      initialAbandonListingActionState,
      formData,
    );

    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      abandonedListingId: null,
      error: "Listing changed and can no longer be abandoned.",
      success: null,
    });
  });
});
