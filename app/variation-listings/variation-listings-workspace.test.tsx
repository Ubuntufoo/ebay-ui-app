import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {VariationListingsWorkspace} from "@/app/variation-listings/variation-listings-workspace";
import type {VariationListingGroup} from "@/lib/sidecar-api";

const fetchMock = vi.fn();

function buildGroup(
  overrides: Partial<VariationListingGroup> = {},
): VariationListingGroup {
  return {
    groupId: "11111111-1111-4111-8111-111111111111",
    groupKey: "VL-G-11111111111141118111111111111111",
    lifecycleState: "review",
    desiredRevision: 3,
    lastConfirmedRevision: 2,
    title: "Tracy McGrady Cards",
    description: "Choose your card.",
    derivedCommonEbayAspects: {},
    categoryId: "261328",
    marketplaceId: "EBAY_US",
    listingFormat: "FIXED_PRICE",
    merchantLocationKey: "main",
    fulfillmentPolicyId: "fulfillment",
    paymentPolicyId: "payment",
    returnPolicyId: "returns",
    conditionId: "4000",
    conditionToken: "EXCELLENT",
    conditionDescription: null,
    conditionDescriptors: [],
    selectorName: "Card",
    skuNamespace: {
      categoryCode: "BSKBL",
      bucketToken: "McGrady",
      nextInventorySerial: 243,
    },
    variationCount: 2,
    totalAvailableQuantity: 3,
    variations: [],
    validation: {
      blockers: [],
      hasPendingChanges: true,
      initialPublicationReady: false,
    },
    journal: {latestRevision: null},
    createdAt: "2026-09-02T15:00:00.000Z",
    updatedAt: "2026-09-02T15:05:00.000Z",
    ...overrides,
  };
}

function buildSession(
  overrides: Partial<import("@/lib/sidecar-api").VariationListingIntakeSession> = {},
): import("@/lib/sidecar-api").VariationListingIntakeSession {
  return {
    captureSourceKey: "camera-1",
    mode: "idle",
    targetGroupId: null,
    targetVariationId: null,
    stickyPriceAmount: 0.99,
    stickyPriceCurrency: "USD",
    pendingPair: null,
    createdAt: "2026-09-02T15:00:00.000Z",
    updatedAt: "2026-09-02T15:00:00.000Z",
    ...overrides,
  };
}

describe("VariationListingsWorkspace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders a clearly separate variation-listing workspace and group summary", () => {
    render(<VariationListingsWorkspace initialGroups={[buildGroup()]} />);

    expect(screen.getByText("Separate mode")).not.toBeNull();
    expect(screen.getByText("Variation listing workspace")).not.toBeNull();
    expect(screen.getAllByText("Tracy McGrady Cards").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending changes")).not.toBeNull();
    expect(screen.getByText("Live refresh")).not.toBeNull();
  });

  it("refreshes group state through the dedicated local API seam", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          groups: [
            buildGroup({
              title: "2003 Topps Basketball",
              variationCount: 4,
              totalAvailableQuantity: 5,
            }),
          ],
        }),
        {headers: {"content-type": "application/json"}, status: 200},
      ),
    );

    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        refreshIntervalMs={20}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/variation-listings",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.getAllByText("2003 Topps Basketball").length).toBeGreaterThan(0);
    expect(screen.queryByText("Tracy McGrady Cards")).toBeNull();
  });

  it("preserves current groups and surfaces a refresh issue when live refresh fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, {status: 503}));

    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        refreshIntervalMs={20}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(screen.getAllByText("Tracy McGrady Cards").length).toBeGreaterThan(0);
    expect(screen.getByText("Refresh issue")).not.toBeNull();
  });

  it("treats a malformed success payload as a failed refresh", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({groups: null}), {status: 200}),
    );

    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        refreshIntervalMs={20}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(screen.getAllByText("Tracy McGrady Cards").length).toBeGreaterThan(0);
    expect(screen.getByText("Refresh issue")).not.toBeNull();
  });

  it("waits for an in-flight refresh before scheduling the next request", async () => {
    let resolveRefresh: ((response: Response) => void) | undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        refreshIntervalMs={20}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRefresh?.(
        new Response(JSON.stringify({groups: [buildGroup()]}), {status: 200}),
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("aborts an in-flight refresh during cleanup", async () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));
    const {unmount} = render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        refreshIntervalMs={20}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("renders the dedicated empty-state shell without standard listing controls", () => {
    render(
      <VariationListingsWorkspace initialGroups={[]} refreshIntervalMs={0} />,
    );

    expect(screen.getByText("No variation listing groups")).not.toBeNull();
    expect(screen.queryByRole("radio", {name: "Single"})).toBeNull();
    expect(screen.queryByRole("radio", {name: "Lot"})).toBeNull();
    expect(screen.queryByRole("radio", {name: "SoldComps"})).toBeNull();
  });

  it("hydrates the armed target and durable price from the intake session", () => {
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        initialIntakeSession={buildSession({
          mode: "new_variation",
          targetGroupId: "11111111-1111-4111-8111-111111111111",
          stickyPriceAmount: 1.99,
        })}
        refreshIntervalMs={0}
      />,
    );

    expect(screen.getByText("Capture armed")).not.toBeNull();
    expect(screen.getByText("$1.99 · new variation")).not.toBeNull();
  });

  it("persists price changes through the local intake API", async () => {
    const session = buildSession();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({session: buildSession({stickyPriceAmount: 1.49})}), {status: 200}),
    );
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        initialIntakeSession={session}
        refreshIntervalMs={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", {name: "$1.49"}));
    await act(async () => await Promise.resolve());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/variation-listings/intake-session",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({mode: "idle", targetGroupId: null, stickyPriceAmount: 1.49}),
      }),
    );
  });

  it("arms and disarms through durable configure calls", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({session: buildSession({mode: "new_variation", targetGroupId: "11111111-1111-4111-8111-111111111111"})}), {status: 200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({session: buildSession()}), {status: 200}));
    render(<VariationListingsWorkspace initialGroups={[buildGroup()]} refreshIntervalMs={0} />);

    fireEvent.click(screen.getByRole("button", {name: "Arm capture"}));
    await act(async () => await Promise.resolve());
    fireEvent.click(screen.getByRole("button", {name: "Disarm"}));
    await act(async () => await Promise.resolve());

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({mode: "new_variation", targetGroupId: "11111111-1111-4111-8111-111111111111", stickyPriceAmount: 0.99}),
    );
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({mode: "idle", targetGroupId: null, stickyPriceAmount: 0.99}),
    );
  });

  it("locks intake writes while a pending pair is present", () => {
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        initialIntakeSession={buildSession({
          mode: "new_variation",
          targetGroupId: "11111111-1111-4111-8111-111111111111",
          pendingPair: {
            pairId: "pair-1",
            mode: "new_variation",
            targetGroupId: "11111111-1111-4111-8111-111111111111",
            targetVariationId: null,
            priceAmount: 0.99,
            priceCurrency: "USD",
            frontSourceRef: "/camera/front.jpg",
            startedAt: "2026-09-02T15:00:00.000Z",
            expectedDesiredRevision: 3,
          },
        })}
        refreshIntervalMs={0}
      />,
    );

    expect(screen.getByText(/Target, mode, and price are locked/)).not.toBeNull();
    expect(screen.getByRole("button", {name: "$1.49"})).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", {name: "Arm capture"})).toHaveProperty("disabled", true);
  });

  it("creates a bucket with trimmed defaults and selects the created bucket", async () => {
    const created = buildGroup({
      groupId: "22222222-2222-4222-8222-222222222222",
      title: "New Bucket",
      skuNamespace: {
        categoryCode: "BSKBL",
        bucketToken: "NewBucket",
        nextInventorySerial: 1,
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(created), {status: 201}),
    );
    render(
      <VariationListingsWorkspace
        creationDefaults={{
          merchantLocationKey: " location-1 ",
          fulfillmentPolicyId: " fulfillment-1 ",
          paymentPolicyId: " payment-1 ",
          returnPolicyId: " returns-1 ",
        }}
        initialGroups={[buildGroup()]}
        refreshIntervalMs={0}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("McGrady or 2003Topps"), {
      target: {value: " NewBucket "},
    });
    fireEvent.click(screen.getByRole("button", {name: "Create bucket"}));
    await act(async () => await Promise.resolve());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/variation-listings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          skuCategoryCode: "BSKBL",
          skuBucketToken: "NewBucket",
          merchantLocationKey: "location-1",
          fulfillmentPolicyId: "fulfillment-1",
          paymentPolicyId: "payment-1",
          returnPolicyId: "returns-1",
          conditionId: "4000",
          conditionToken: "VERY_GOOD",
        }),
      }),
    );
    expect(screen.getAllByText("New Bucket").length).toBeGreaterThan(0);
    expect(screen.getByText("Capture setup")).not.toBeNull();
  });

  it("blocks intake writes on initial read failure and hydrates after retry", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: buildSession({
            mode: "new_variation",
            targetGroupId: "11111111-1111-4111-8111-111111111111",
            stickyPriceAmount: 2.49,
          }),
        }),
        {status: 200},
      ),
    );
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup()]}
        initialIntakeError="Intake session unavailable."
        refreshIntervalMs={0}
      />,
    );

    expect(screen.getByText("Intake session unavailable.")).not.toBeNull();
    expect(screen.getByRole("button", {name: "Arm capture"})).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", {name: "$1.49"})).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", {name: "Retry intake read"}));
    await act(async () => await Promise.resolve());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/variation-listings/intake-session",
      expect.objectContaining({cache: "no-store"}),
    );
    expect(screen.queryByText("Intake session unavailable.")).toBeNull();
    expect(screen.getByText("Capture armed")).not.toBeNull();
    expect(screen.getByText("$2.49 · new variation")).not.toBeNull();
  });

  it("ignores a stale intake GET that settles after a successful configure", async () => {
    let rejectStaleRead: ((reason?: unknown) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({groups: [buildGroup()]}), {status: 200}))
      .mockReturnValueOnce(
        new Promise<Response>((_, reject) => {
          rejectStaleRead = reject;
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: buildSession({
              mode: "new_variation",
              targetGroupId: "11111111-1111-4111-8111-111111111111",
            }),
          }),
          {status: 200},
        ),
      );
    render(<VariationListingsWorkspace initialGroups={[buildGroup()]} refreshIntervalMs={20} />);

    await act(async () => await vi.advanceTimersByTimeAsync(20));
    fireEvent.click(screen.getByRole("button", {name: "Arm capture"}));
    await act(async () => await Promise.resolve());

    await act(async () => {
      rejectStaleRead?.(new Error("stale read failed"));
      await Promise.resolve();
    });

    expect(screen.getByText("Capture armed")).not.toBeNull();
    expect(screen.queryByText("stale read failed")).toBeNull();
  });
});
