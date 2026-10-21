import {describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => {
  class MockSidecarApiError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
  }
  return {read: vi.fn(), MockSidecarApiError};
});

vi.mock("@/lib/sidecar-api", () => ({
  getVariationListingQuantityStatus: mocks.read,
  SidecarApiError: mocks.MockSidecarApiError,
}));

import {GET} from "@/app/api/variation-listings/[groupId]/quantity-status/route";

describe("variation quantity status proxy", () => {
  it("forwards the encoded group read", async () => {
    const status = {groupId: "group/1", desiredRevision: 4, lastConfirmedRevision: 3, variations: []};
    mocks.read.mockResolvedValueOnce(status);
    const response = await GET(
      new Request("http://local"),
      {params: Promise.resolve({groupId: "group/1"})},
    );

    expect(response.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith("group/1");
    await expect(response.json()).resolves.toEqual(status);
  });

  it("preserves Sidecar conflict status", async () => {
    mocks.read.mockRejectedValueOnce(new mocks.MockSidecarApiError("not active", 409));
    const response = await GET(
      new Request("http://local"),
      {params: Promise.resolve({groupId: "group/1"})},
    );
    expect(response.status).toBe(409);
  });
});
