import {act, cleanup, render, screen} from "@testing-library/react";
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
    expect(screen.getByText("Tracy McGrady Cards")).not.toBeNull();
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
    expect(screen.getByText("2003 Topps Basketball")).not.toBeNull();
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

    expect(screen.getByText("Tracy McGrady Cards")).not.toBeNull();
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

    expect(screen.getByText("Tracy McGrady Cards")).not.toBeNull();
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
});
