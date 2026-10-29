import {describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => {
  class MockSidecarApiError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
  }
  return {update: vi.fn(), MockSidecarApiError};
});
vi.mock("@/lib/sidecar-api", () => ({updateVariationListingPrice: mocks.update, SidecarApiError: mocks.MockSidecarApiError}));
import {PATCH} from "@/app/api/variation-listings/[groupId]/variations/[variationId]/price/route";

const context = {params: Promise.resolve({groupId: "group/1", variationId: "variation/2"})};
const request = () => new Request("http://local", {method: "PATCH", body: JSON.stringify({expectedDesiredRevision: 3, priceAmount: 1.49})});

describe("variation price update proxy", () => {
  it("forwards the price edit with CAS revision", async () => {
    mocks.update.mockResolvedValueOnce({groupId: "group/1", desiredRevision: 4});
    const response = await PATCH(request(), context);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("group/1", "variation/2", {expectedDesiredRevision: 3, priceAmount: 1.49});
  });
  it("preserves Sidecar conflict status", async () => {
    mocks.update.mockRejectedValueOnce(new mocks.MockSidecarApiError("stale revision", 409));
    const response = await PATCH(request(), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: "stale revision"});
  });
});
