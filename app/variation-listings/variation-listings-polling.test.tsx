import {act, cleanup, render} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {VariationListingsWorkspace} from "@/app/variation-listings/variation-listings-workspace";
import type {VariationListingIntakeSession} from "@/lib/sidecar-api";

const fetchMock = vi.fn();
const session = (mode: VariationListingIntakeSession["mode"]): VariationListingIntakeSession => ({
  captureSourceKey: "camera-1",
  mode,
  targetGroupId: mode === "idle" ? null : "group-1",
  targetVariationId: null,
  copyConditionToken: null,
  stickyPriceAmount: 0.99,
  stickyPriceCurrency: "USD",
  pendingPair: null,
  processingStatus: null,
  createdAt: "2026-11-05T12:00:00Z",
  updatedAt: "2026-11-05T12:00:00Z",
});

describe("variation workspace polling cadence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) => Promise.resolve(
      new Response(
        JSON.stringify(url.endsWith("/intake-session")
          ? {session: session("idle"), captureWorkspace: "variation"}
          : {groups: []}),
        {status: 200},
      ),
    ));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses a 60-second interval for normal idle viewing", async () => {
    render(<VariationListingsWorkspace initialGroups={[]} initialCaptureWorkspace="variation" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/variation-listings", "/api/variation-listings/intake-session",
    ]);
  });

  it("uses a 2-second interval when capture is armed", async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(
      new Response(
        JSON.stringify(url.endsWith("/intake-session")
          ? {session: session("idle"), captureWorkspace: "variation"}
          : {groups: []}),
        {status: 200},
      ),
    ));
    render(<VariationListingsWorkspace
      initialGroups={[]}
      initialCaptureWorkspace="variation"
      initialIntakeSession={{...session("new_variation"), targetGroupId: null}}
    />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("pauses when hidden and refreshes immediately when visible again", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    render(<VariationListingsWorkspace initialGroups={[]} initialCaptureWorkspace="variation" />);
    visibility = "hidden";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(fetchMock).not.toHaveBeenCalled();

    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("aborts an in-flight hidden refresh and does not schedule its stale completion", async () => {
    let resolveGroups: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveGroups = resolve;
    }));
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    render(<VariationListingsWorkspace initialGroups={[]} initialCaptureWorkspace="variation" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;

    visibility = "hidden";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(signal.aborted).toBe(true);

    await act(async () => {
      resolveGroups?.(new Response(JSON.stringify({groups: []}), {status: 200}));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps one timer after rapid hide/show transitions", async () => {
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    render(<VariationListingsWorkspace initialGroups={[]} initialCaptureWorkspace="variation" />);

    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });
    visibility = "hidden";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
