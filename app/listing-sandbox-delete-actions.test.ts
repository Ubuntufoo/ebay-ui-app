import {beforeEach, describe, expect, it, vi} from "vitest";

import {deleteSandboxListingAction} from "@/app/listing-sandbox-delete-actions";
import {initialDeleteSandboxListingActionState} from "@/app/listing-sandbox-delete-state";

const {deleteSandboxListingMock, revalidatePathMock} = vi.hoisted(() => ({
  deleteSandboxListingMock: vi.fn(),
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
    deleteSandboxListing: deleteSandboxListingMock,
    SidecarApiError,
  };
});

function buildFormData() {
  const formData = new FormData();
  formData.set("listing_id", " Single-000005 ");
  formData.set("expected_sku", " BSKBL-Single-000005 ");
  formData.set("expected_updated_at", " 2026-07-30T18:43:17.000Z ");
  return formData;
}

describe("deleteSandboxListingAction", () => {
  beforeEach(() => {
    deleteSandboxListingMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it.each([
    ["listing_id", "Listing ID is required."],
    ["expected_sku", "A valid structured SKU is required."],
    ["expected_updated_at", "Listing updated time is required."],
  ])("validates %s before calling the sidecar", async (field, error) => {
    const formData = buildFormData();
    formData.delete(field);

    const result = await deleteSandboxListingAction(
      initialDeleteSandboxListingActionState,
      formData,
    );

    expect(deleteSandboxListingMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      deletedListingId: null,
      deletedSku: null,
      error,
      success: null,
    });
  });

  it("sends exact persisted values and revalidates the dashboard", async () => {
    deleteSandboxListingMock.mockResolvedValueOnce({
      deleted: true,
      listingId: "Single-000005",
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
    });

    const result = await deleteSandboxListingAction(
      initialDeleteSandboxListingActionState,
      buildFormData(),
    );

    expect(deleteSandboxListingMock).toHaveBeenCalledWith("Single-000005", {
      expectedSku: "BSKBL-Single-000005",
      expectedUpdatedAt: "2026-07-30T18:43:17.000Z",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      deletedListingId: "Single-000005",
      deletedSku: "BSKBL-Single-000005",
      error: null,
      success: "Deleted sandbox listing BSKBL-Single-000005.",
    });
  });

  it("returns the backend response message without revalidating", async () => {
    const {SidecarApiError} = await import("@/lib/sidecar-api");
    deleteSandboxListingMock.mockRejectedValueOnce(
      new SidecarApiError("Sidecar request failed with 409.", 409, {
        error: "stale_listing",
        message: "Listing changed. Refresh before deleting.",
      }),
    );

    const result = await deleteSandboxListingAction(
      initialDeleteSandboxListingActionState,
      buildFormData(),
    );

    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      deletedListingId: null,
      deletedSku: null,
      error: "Listing changed. Refresh before deleting.",
      success: null,
    });
  });
});
