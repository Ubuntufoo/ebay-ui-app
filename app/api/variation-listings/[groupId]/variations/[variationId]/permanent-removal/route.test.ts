import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => {
  class MockSidecarApiError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
  }
  return {stage: vi.fn(), MockSidecarApiError};
});

vi.mock("@/lib/sidecar-api", () => ({
  stageVariationListingPermanentRemoval: mocks.stage,
  SidecarApiError: mocks.MockSidecarApiError,
}));

import {PATCH} from "@/app/api/variation-listings/[groupId]/variations/[variationId]/permanent-removal/route";

const ctx = {params: Promise.resolve({groupId: "group/1", variationId: "variation/2"})};
function request(remove: unknown, expectedDesiredRevision: unknown = 3) {
  return new Request("http://local", {method: "PATCH", body: JSON.stringify({remove, expectedDesiredRevision})});
}

describe("sold-out variation removal proxy", () => {
  beforeEach(() => {
    mocks.stage.mockReset();
  });

  it("passes an explicit staged removal with CAS and exact identities", async () => {
    mocks.stage.mockResolvedValueOnce({groupId: "group/1", desiredRevision: 4});
    const response = await PATCH(request(true), ctx);
    expect(response.status).toBe(200);
    expect(mocks.stage).toHaveBeenCalledWith("group/1", "variation/2", {expectedDesiredRevision: 3, remove: true});
  });

  it("passes cancellation without a fresh eBay read", async () => {
    mocks.stage.mockResolvedValueOnce({groupId: "group/1", desiredRevision: 5});
    const response = await PATCH(request(false, 4), ctx);
    expect(response.status).toBe(200);
    expect(mocks.stage).toHaveBeenCalledWith("group/1", "variation/2", {expectedDesiredRevision: 4, remove: false});
  });

  it("rejects malformed stage intent before calling Sidecar", async () => {
    for (const [remove, revision] of [[undefined, 3], [true, -1], ["true", 3], [false, 1.5]] as const) {
      const response = await PATCH(request(remove, revision), ctx);
      expect(response.status).toBe(400);
    }
    expect(mocks.stage).not.toHaveBeenCalled();
  });

  it("preserves Sidecar stale-eligibility conflict", async () => {
    mocks.stage.mockRejectedValueOnce(new mocks.MockSidecarApiError("eBay quantities no longer zero", 409));
    const response = await PATCH(request(true), ctx);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("eBay quantities");
  });
});
