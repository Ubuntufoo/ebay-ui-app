import {describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => {
  class MockSidecarApiError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
  }
  return {update: vi.fn(), MockSidecarApiError};
});

vi.mock("@/lib/sidecar-api", () => ({
  updateVariationListingQuantityAdjustment: mocks.update,
  SidecarApiError: mocks.MockSidecarApiError,
}));

import {PATCH} from "@/app/api/variation-listings/[groupId]/variations/[variationId]/quantity-adjustment/route";

describe("variation quantity adjustment proxy", () => {
  it("forwards the signed CAS adjustment", async () => {
    mocks.update.mockResolvedValueOnce({groupId: "group/1", desiredRevision: 4});
    const response = await PATCH(
      new Request("http://local", {
        method: "PATCH",
        body: JSON.stringify({expectedDesiredRevision: 3, delta: 1}),
      }),
      {params: Promise.resolve({groupId: "group/1", variationId: "variation/2"})},
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("group/1", "variation/2", {expectedDesiredRevision: 3, delta: 1});
  });

  it("preserves Sidecar conflict status", async () => {
    mocks.update.mockRejectedValueOnce(new mocks.MockSidecarApiError("stale", 409));
    const response = await PATCH(
      new Request("http://local", {
        method: "PATCH",
        body: JSON.stringify({expectedDesiredRevision: 3, delta: -1}),
      }),
      {params: Promise.resolve({groupId: "group/1", variationId: "variation/2"})},
    );

    expect(response.status).toBe(409);
  });
});
