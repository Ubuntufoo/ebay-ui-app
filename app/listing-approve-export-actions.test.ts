import {beforeEach, describe, expect, it, vi} from "vitest";

import {approveListingForExport} from "@/app/listing-approve-export-actions";

const {
  getListingMock,
  revalidatePathMock,
  updateListingWorkflowStateMock,
} = vi.hoisted(() => ({
  getListingMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  updateListingWorkflowStateMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/sidecar-api", () => {
  class SidecarApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "SidecarApiError";
      this.status = status;
    }
  }

  return {
    SidecarApiError,
    getListing: getListingMock,
    updateListingWorkflowState: updateListingWorkflowStateMock,
  };
});

describe("approveListingForExport", () => {
  beforeEach(() => {
    getListingMock.mockReset();
    revalidatePathMock.mockReset();
    updateListingWorkflowStateMock.mockReset();
  });

  it("approves listing for export from needs_review", async () => {
    getListingMock.mockResolvedValueOnce({status: "needs_review"});
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("current_status", "needs_review");

    const result = await approveListingForExport({error: null, success: null}, formData);

    expect(getListingMock).toHaveBeenCalledWith("LIST-001");
    expect(updateListingWorkflowStateMock).toHaveBeenCalledWith("LIST-001", {
      status: "approved_for_export",
      subStatus: "publish_queued",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      error: null,
      success: "Approved LIST-001 for export.",
    });
  });

  it("rejects submitted status outside needs_review", async () => {
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("current_status", "assets_ready");

    const result = await approveListingForExport({error: null, success: null}, formData);

    expect(getListingMock).not.toHaveBeenCalled();
    expect(updateListingWorkflowStateMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Only listings in Needs review can be approved for export.",
      success: null,
    });
  });

  it("rejects stale status changes before submit", async () => {
    getListingMock.mockResolvedValueOnce({status: "approved_for_export"});
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("current_status", "needs_review");

    const result = await approveListingForExport({error: null, success: null}, formData);

    expect(updateListingWorkflowStateMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Listing status changed to Approved for export. Refresh and try again.",
      success: null,
    });
  });

  it("propagates SidecarApiError messages", async () => {
    getListingMock.mockResolvedValueOnce({status: "needs_review"});
    const {SidecarApiError} = await import("@/lib/sidecar-api");
    updateListingWorkflowStateMock.mockRejectedValueOnce(
      new SidecarApiError("Sidecar request failed.", 500),
    );
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("current_status", "needs_review");

    const result = await approveListingForExport({error: null, success: null}, formData);

    expect(result).toEqual({
      error: "Sidecar request failed.",
      success: null,
    });
  });
});
