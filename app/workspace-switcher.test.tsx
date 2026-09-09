import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {
  WorkspaceSwitcher,
  ensureStandardCaptureRouting,
  inspectStandardCaptureRouting,
} from "@/app/workspace-switcher";
import type {VariationListingIntakeSession} from "@/lib/sidecar-api";

function session(
  overrides: Partial<VariationListingIntakeSession> = {},
): VariationListingIntakeSession {
  return {
    captureSourceKey: "camera-1",
    mode: "duplicate_copy",
    targetGroupId: "11111111-1111-4111-8111-111111111111",
    targetVariationId: "22222222-2222-4222-8222-222222222222",
    copyConditionToken: "NEAR_MINT_OR_BETTER",
    stickyPriceAmount: 1.49,
    stickyPriceCurrency: "USD",
    pendingPair: null,
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type": "application/json"},
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("workspace capture routing", () => {
  it("returns a fail-closed result when routing verification cannot reach the Sidecar", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network offline"));

    await expect(inspectStandardCaptureRouting(fetchMock)).resolves.toEqual({
      success: false,
      error: "network offline",
    });
    await expect(ensureStandardCaptureRouting(fetchMock)).resolves.toEqual({
      success: false,
      error: "network offline",
    });
  });

  it("does not treat a malformed routing response as idle", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));

    await expect(inspectStandardCaptureRouting(fetchMock)).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("malformed"),
    });
    await expect(ensureStandardCaptureRouting(fetchMock)).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("malformed"),
    });
  });

  it("disarms an armed variation intake session before Standard capture is ready", async () => {
    const armed = session();
    const idle = session({
      mode: "idle",
      targetGroupId: null,
      targetVariationId: null,
      copyConditionToken: null,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({session: armed}))
      .mockResolvedValueOnce(jsonResponse({session: idle}));

    await expect(ensureStandardCaptureRouting(fetchMock)).resolves.toEqual({
      success: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/variation-listings/intake-session",
      {cache: "no-store"},
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/variation-listings/intake-session",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          mode: "idle",
          targetGroupId: null,
          targetVariationId: null,
          copyConditionToken: null,
          stickyPriceAmount: 1.49,
        }),
      }),
    );
  });

  it("blocks Standard routing without mutating when a variation pair is pending", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        session: session({
          pendingPair: {
            pairId: "33333333-3333-4333-8333-333333333333",
            mode: "duplicate_copy",
            targetGroupId: "11111111-1111-4111-8111-111111111111",
            targetVariationId: "22222222-2222-4222-8222-222222222222",
            conditionToken: "NEAR_MINT_OR_BETTER",
            priceAmount: 1.49,
            priceCurrency: "USD",
            frontSourceRef: "front.jpg",
            startedAt: "2026-09-08T00:00:00.000Z",
            expectedDesiredRevision: 10,
          },
        }),
      }),
    );

    const result = await ensureStandardCaptureRouting(fetchMock);
    expect(result).toMatchObject({success: false});
    if (!result.success) expect(result.error).toContain("pending");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("detects when another tab has armed Variation without mutating routing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({session: session({mode: "new_variation", targetVariationId: null, copyConditionToken: null})}),
    );

    const result = await inspectStandardCaptureRouting(fetchMock);

    expect(result).toMatchObject({success: false});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({cache: "no-store"});
  });

  it("does not navigate from Variation until Standard routing has been made safe", async () => {
    const navigate = vi.fn();
    const ensureStandardRouting = vi.fn().mockResolvedValue({success: true});
    render(
      <WorkspaceSwitcher
        currentWorkspace="variation"
        ensureStandardRouting={ensureStandardRouting}
        navigate={navigate}
      />,
    );

    fireEvent.click(screen.getByRole("link", {name: "Standard listings"}));

    await waitFor(() => expect(ensureStandardRouting).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("surfaces a rejected activation request and stays on Variation", async () => {
    const ensureStandardRouting = vi
      .fn()
      .mockRejectedValue(new Error("network offline"));
    const navigate = vi.fn();
    render(
      <WorkspaceSwitcher
        currentWorkspace="variation"
        ensureStandardRouting={ensureStandardRouting}
        navigate={navigate}
      />,
    );

    fireEvent.click(screen.getByRole("link", {name: "Standard listings"}));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("network offline"));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores an older activation result when Standard is clicked again", async () => {
    let resolveFirst: ((value: {success: false; error: string}) => void) | undefined;
    let resolveSecond: ((value: {success: true}) => void) | undefined;
    const ensureStandardRouting = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{success: false; error: string}>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<{success: true}>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const navigate = vi.fn();
    render(
      <WorkspaceSwitcher
        currentWorkspace="variation"
        ensureStandardRouting={ensureStandardRouting}
        navigate={navigate}
      />,
    );

    const standardLink = screen.getByRole("link", {name: "Standard listings"});
    fireEvent.click(standardLink);
    fireEvent.click(standardLink);
    expect(ensureStandardRouting).toHaveBeenCalledTimes(2);

    resolveFirst?.({success: false, error: "stale failure"});
    resolveSecond?.({success: true});

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not present Standard as active until direct-load routing verification succeeds", async () => {
    let resolveRouting: ((value: {success: true}) => void) | undefined;
    const ensureStandardRouting = vi.fn(
      () =>
        new Promise<{success: true}>((resolve) => {
          resolveRouting = resolve;
        }),
    );
    render(
      <WorkspaceSwitcher
        currentWorkspace="standard"
        guardStandardCaptureRouting
        ensureStandardRouting={ensureStandardRouting}
        navigate={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", {name: "Activating Standard…"}).getAttribute("aria-current")).toBeNull();
    resolveRouting?.({success: true});

    await waitFor(() =>
      expect(
        screen.getByRole("link", {name: "Standard listings"}).getAttribute("aria-current"),
      ).toBe("page"),
    );
  });
});
