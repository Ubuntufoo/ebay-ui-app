import {beforeEach, describe, expect, it, vi} from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
const configureMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sidecar-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sidecar-api")>()),
  getVariationListingIntakeSession: getSessionMock,
  configureVariationListingIntake: configureMock,
}));

import {GET, PATCH} from "@/app/api/variation-listings/intake-session/route";
import {SidecarApiError} from "@/lib/sidecar-api";

describe("variation listing intake-session route", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    configureMock.mockReset();
  });

  it("returns the durable session envelope", async () => {
    getSessionMock.mockResolvedValue({session: null});
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({session: null});
  });

  it("preserves Sidecar status for GET failures", async () => {
    getSessionMock.mockRejectedValue(new SidecarApiError("conflict", 409));
    const response = await GET();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: "conflict"});
  });

  it("forwards strict PATCH input and returns the configured session", async () => {
    const session = {
      captureSourceKey: "camera-1",
      mode: "idle",
      targetGroupId: null,
      targetVariationId: null,
      stickyPriceAmount: 1.99,
      stickyPriceCurrency: "USD",
      pendingPair: null,
      createdAt: "2026-09-02T15:00:00.000Z",
      updatedAt: "2026-09-02T15:01:00.000Z",
    };
    configureMock.mockResolvedValue(session);
    const response = await PATCH(
      new Request("http://localhost/api/variation-listings/intake-session", {
        method: "PATCH",
        body: JSON.stringify({mode: "idle", targetGroupId: null, stickyPriceAmount: 1.99}),
      }),
    );
    expect(configureMock).toHaveBeenCalledWith({
      mode: "idle",
      targetGroupId: null,
      stickyPriceAmount: 1.99,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({session});
  });

  it("preserves Sidecar status for PATCH conflicts", async () => {
    configureMock.mockRejectedValue(new SidecarApiError("pending pair", 409));
    const response = await PATCH(
      new Request("http://localhost/api/variation-listings/intake-session", {
        method: "PATCH",
        body: JSON.stringify({mode: "idle", targetGroupId: null, stickyPriceAmount: 0.99}),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: "pending pair"});
  });
});
