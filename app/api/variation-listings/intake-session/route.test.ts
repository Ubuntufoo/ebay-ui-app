import {beforeEach, describe, expect, it, vi} from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
const configureMock = vi.hoisted(() => vi.fn());
const configureEnvelopeMock = vi.hoisted(() => vi.fn());
const discardMock = vi.hoisted(() => vi.fn());
const retryMock = vi.hoisted(() => vi.fn());
const workspaceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sidecar-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sidecar-api")>()),
  getVariationListingIntakeSession: getSessionMock,
  configureVariationListingIntake: configureMock,
  configureVariationListingIntakeEnvelope: configureEnvelopeMock,
  discardVariationListingPendingPair: discardMock,
  retryVariationListingPendingPair: retryMock,
  updateVariationListingCaptureWorkspace: workspaceMock,
}));

import {DELETE, GET, PATCH, POST} from "@/app/api/variation-listings/intake-session/route";
import {SidecarApiError} from "@/lib/sidecar-api";

describe("variation listing intake-session route", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    configureMock.mockReset();
    configureEnvelopeMock.mockReset();
    discardMock.mockReset();
    retryMock.mockReset();
    workspaceMock.mockReset();
  });

  it("returns the durable session envelope", async () => {
    getSessionMock.mockResolvedValue({session: null, captureWorkspace: "standard"});
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({session: null, captureWorkspace: "standard"});
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
      copyConditionToken: null,
      stickyPriceAmount: 1.99,
      stickyPriceCurrency: "USD",
      pendingPair: null,
      processingStatus: null,
      createdAt: "2026-09-02T15:00:00.000Z",
      updatedAt: "2026-09-02T15:01:00.000Z",
    };
    configureEnvelopeMock.mockResolvedValue({session, captureWorkspace: "variation"});
    const response = await PATCH(
      new Request("http://localhost/api/variation-listings/intake-session", {
        method: "PATCH",
        body: JSON.stringify({captureWorkspace: "variation", mode: "idle", targetGroupId: null, stickyPriceAmount: 1.99}),
      }),
    );
    expect(configureEnvelopeMock).toHaveBeenCalledWith({
      captureWorkspace: "variation",
      mode: "idle",
      targetGroupId: null,
      stickyPriceAmount: 1.99,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({session, captureWorkspace: "variation"});
  });

  it("preserves Sidecar status for PATCH conflicts", async () => {
    configureEnvelopeMock.mockRejectedValue(new SidecarApiError("pending pair", 409));
    const response = await PATCH(
      new Request("http://localhost/api/variation-listings/intake-session", {
        method: "PATCH",
        body: JSON.stringify({captureWorkspace: "variation", mode: "idle", targetGroupId: null, stickyPriceAmount: 0.99}),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: "pending pair"});
  });

  it("returns the durable session after discarding a pending pair", async () => {
    const session = {mode: "idle", pendingPair: null};
    discardMock.mockResolvedValue(session);
    const response = await DELETE();
    expect(discardMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({session});
  });

  it("forwards workspace-only ownership claims without changing intake config", async () => {
    workspaceMock.mockResolvedValue({session: null, captureWorkspace: "variation"});
    const response = await PATCH(
      new Request("http://localhost/api/variation-listings/intake-session", {
        method: "PATCH",
        body: JSON.stringify({captureWorkspace: "variation"}),
      }),
    );
    expect(workspaceMock).toHaveBeenCalledWith("variation");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({session: null, captureWorkspace: "variation"});
  });

  it("proxies POST retry requests without a client payload", async () => {
    const session = {mode: "new_variation", pendingPair: {pairId: "pair-1"}};
    retryMock.mockResolvedValue(session);

    const response = await POST();

    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(retryMock).toHaveBeenCalledWith();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({session});
  });

  it("preserves Sidecar status for POST retry failures", async () => {
    retryMock.mockRejectedValue(new SidecarApiError("retry already requested", 409));

    const response = await POST();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: "retry already requested"});
  });
});
