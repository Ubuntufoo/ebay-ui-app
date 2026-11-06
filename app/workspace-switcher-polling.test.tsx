import {act, cleanup, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {WorkspaceSwitcher} from "@/app/workspace-switcher";

const ready = {success: true} as const;
const active = {success: true, captureActive: true} as const;

async function mountSwitcher(
  initial: typeof ready | typeof active = ready,
  workspace: "standard" | "variation" = "variation",
) {
  const ensure = vi.fn().mockResolvedValue(initial);
  const inspect = vi.fn().mockResolvedValue(initial);
  render(
    <WorkspaceSwitcher
      currentWorkspace={workspace}
      guardVariationCaptureRouting={workspace === "variation"}
      guardStandardCaptureRouting={workspace === "standard"}
      ensureVariationRouting={ensure}
      ensureStandardRouting={ensure}
      inspectVariationRouting={inspect}
      inspectStandardRouting={inspect}
      navigate={vi.fn()}
    />,
  );
  await act(async () => { await Promise.resolve(); });
  return {ensure, inspect};
}

describe("workspace routing poll cadence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("revalidates idle Variation routing every 60 seconds, not every 2 seconds", async () => {
    const {inspect} = await mountSwitcher();
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(inspect).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("revalidates armed Variation routing every 2 seconds", async () => {
    const {inspect} = await mountSwitcher(active);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
    expect(inspect).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("uses idle cadence on the Standard page too", async () => {
    const {inspect} = await mountSwitcher(ready, "standard");
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(inspect).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(58_000); });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("switches cadence immediately on same-tab arm and disarm", async () => {
    const {inspect} = await mountSwitcher();
    inspect.mockResolvedValue(active);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("variation-intake-activity", {detail: true}));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(inspect).toHaveBeenCalledTimes(1);
    inspect.mockResolvedValue(ready);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("variation-intake-activity", {detail: false}));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(inspect).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it("pauses hidden tabs, refreshes immediately on return, then stays idle", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const {inspect} = await mountSwitcher();

    visibility = "hidden";
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(inspect).not.toHaveBeenCalled();

    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(inspect).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(inspect).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it("aborts in-flight checks and ignores stale errors after hiding", async () => {
    let settle: ((value: {success: false; error: string}) => void) | undefined;
    const inspect = vi.fn().mockImplementationOnce(
      () => new Promise<{success: false; error: string}>((resolve) => { settle = resolve; }),
    ).mockResolvedValue(ready);
    render(
      <WorkspaceSwitcher currentWorkspace="variation" guardVariationCaptureRouting
        ensureVariationRouting={vi.fn().mockResolvedValue(active)}
        inspectVariationRouting={inspect} navigate={vi.fn()} />,
    );
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    const signal = inspect.mock.calls[0]?.[0] as AbortSignal;
    expect(signal?.aborted).toBe(false);

    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(signal.aborted).toBe(true);
    await act(async () => { settle?.({success: false, error: "stale hidden failure"}); });
    expect(screen.queryByText("stale hidden failure")).toBeNull();

    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it("keeps one polling loop after rapid hidden/visible transitions", async () => {
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const {inspect} = await mountSwitcher();

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
    expect(inspect).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(inspect).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(inspect).toHaveBeenCalledTimes(3);
  });

  it("does not reset the idle deadline on an incidental rerender with default inspection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({session: null, captureWorkspace: "variation"}), {status: 200}),
    );
    vi.stubGlobal("fetch", fetchMock);
    const ensureVariationRouting = vi.fn().mockResolvedValue(ready);
    const navigate = vi.fn();
    const view = render(
      <WorkspaceSwitcher
        currentWorkspace="variation"
        guardVariationCaptureRouting
        ensureVariationRouting={ensureVariationRouting}
        navigate={navigate}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(59_000); });
    expect(fetchMock).not.toHaveBeenCalled();
    view.rerender(
      <WorkspaceSwitcher
        currentWorkspace="variation"
        guardVariationCaptureRouting
        ensureVariationRouting={ensureVariationRouting}
        navigate={navigate}
      />,
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/variation-listings/intake-session");
  });
});
