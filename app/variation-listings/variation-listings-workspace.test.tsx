import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {VariationListingsWorkspace} from "@/app/variation-listings/variation-listings-workspace";
import type {
  VariationListingCopy,
  VariationListingGroup,
  VariationListingVariation,
} from "@/lib/sidecar-api";

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
    copyConditionToken: null,
    stickyPriceAmount: 0.99,
    stickyPriceCurrency: "USD",
    pendingPair: null,
    createdAt: "2026-09-02T15:00:00.000Z",
    updatedAt: "2026-09-02T15:00:00.000Z",
    ...overrides,
  };
}

function buildVariation(
  overrides: Partial<VariationListingVariation> = {},
): VariationListingVariation {
  const copy = (copyId: string, isRepresentative: boolean): VariationListingCopy => ({
    copyId,
    availabilityState: "available",
    conditionToken: "NEAR_MINT_OR_BETTER",
    conditionNotes: isRepresentative ? "Sharp corners" : "Light edge wear",
    frontR2Key: `copies/${copyId}/front.jpg`,
    backR2Key: `copies/${copyId}/back.jpg`,
    frontImageUrl: `https://images.example/${copyId}/front.jpg`,
    backImageUrl: `https://images.example/${copyId}/back.jpg`,
    captureSourceKey: "camera-1",
    capturePairId: `pair-${copyId}`,
    capturedAt: "2026-09-02T15:00:00.000Z",
    createdAt: "2026-09-02T15:00:00.000Z",
    updatedAt: "2026-09-02T15:00:00.000Z",
    isRepresentative,
  });

  return {
    variationId: "variation-1",
    position: 0,
    inventorySerial: 243,
    sku: "BSKBL-McGrady-000243",
    selectorValue: "2003 Topps",
    priceAmount: 1.99,
    priceCurrency: "USD",
    representativeCopyId: "copy-1",
    availableQuantity: 2,
    copyCount: 2,
    variationMetadata: {},
    copies: [copy("copy-1", true), copy("copy-2", false)],
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

  it("shows reconciliation badge only for current recovery state", () => {
    const historicalUnknown = {
      revisionId: "revision-3",
      capturedDesiredRevision: 3,
      operationCount: 1,
      capturedAt: "2026-09-03T00:00:00Z",
      hasUnknownOutcome: true,
      retryExhausted: false,
      recovery: {revisionId: "revision-3", retryStatus: "not_applicable", remoteState: "known_unchanged", requiresReconciliation: false, recommendedActions: []},
      operations: [],
    } as unknown as NonNullable<VariationListingGroup["journal"]["latestRevision"]>;
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({journal: {latestRevision: historicalUnknown}})]}
        refreshIntervalMs={0}
      />,
    );
    expect(screen.queryByText("Reconciliation required")).toBeNull();

    cleanup();
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({journal: {latestRevision: {...historicalUnknown, recovery: {revisionId: "revision-3", retryStatus: "reconciliation_required", remoteState: "unknown", requiresReconciliation: true, recommendedActions: []}}}})]}
        refreshIntervalMs={0}
      />,
    );
    expect(screen.getByText("Reconciliation required")).not.toBeNull();
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

  it("does not let a stale poll overwrite a newer confirmed action result", async () => {
    const confirmed = buildGroup({title: "Published revision", desiredRevision: 4, lastConfirmedRevision: 4, updatedAt: "2026-09-02T15:10:00.000Z", validation: {blockers: [], initialPublicationReady: false, hasPendingChanges: false}});
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({groups: [buildGroup({title: "Stale poll", desiredRevision: 4, lastConfirmedRevision: 3, updatedAt: "2026-09-02T15:20:00.000Z"})]}), {status: 200}));
    render(<VariationListingsWorkspace initialGroups={[confirmed]} refreshIntervalMs={20} />);
    await act(async () => await vi.advanceTimersByTimeAsync(20));
    expect(screen.getAllByText("Published revision").length).toBeGreaterThan(0);
    expect(screen.queryByText("Stale poll")).toBeNull();
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

  it("reconciles the selected bucket to an externally armed duplicate target during polling", async () => {
    const groupA = buildGroup({
      title: "Group A",
      conditionToken: "EXCELLENT",
      variations: [buildVariation()],
    });
    const groupB = buildGroup({
      groupId: "22222222-2222-4222-8222-222222222222",
      title: "Group B",
      conditionToken: "VERY_GOOD",
      variations: [buildVariation({variationId: "variation-b"})],
    });
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({groups: [groupA, groupB]}), {status: 200}))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: buildSession({
              mode: "duplicate_copy",
              targetGroupId: groupB.groupId,
              targetVariationId: "variation-b",
              copyConditionToken: "EXCELLENT",
              stickyPriceAmount: 1.99,
            }),
          }),
          {status: 200},
        ),
      );

    render(
      <VariationListingsWorkspace
        initialGroups={[groupA, groupB]}
        refreshIntervalMs={20}
      />,
    );

    await act(async () => await vi.advanceTimersByTimeAsync(20));

    expect(screen.getAllByText("Group B").length).toBeGreaterThan(0);
    const selector = screen.getByRole("combobox", {name: "Duplicate-copy condition"}) as HTMLSelectElement;
    expect(selector.value).toBe("EXCELLENT");
    expect(Array.from(selector.options).map((option) => option.value)).toEqual([
      "NEAR_MINT_OR_BETTER",
      "EXCELLENT",
      "VERY_GOOD",
    ]);
    expect(screen.getByText(/Existing duplicate-copy mode is active; this workspace can only disarm it\. Condition: Excellent\./)).not.toBeNull();
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
        body: JSON.stringify({mode: "idle", targetGroupId: null, targetVariationId: null, copyConditionToken: null, stickyPriceAmount: 1.49}),
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
      JSON.stringify({mode: "new_variation", targetGroupId: "11111111-1111-4111-8111-111111111111", targetVariationId: null, copyConditionToken: null, stickyPriceAmount: 0.99}),
    );
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({mode: "idle", targetGroupId: null, targetVariationId: null, copyConditionToken: null, stickyPriceAmount: 0.99}),
    );
  });

  it("arms and disarms duplicate capture for the exact variation price", async () => {
    const variation = buildVariation();
    const otherVariation = buildVariation({
      variationId: "variation-2",
      selectorValue: "2004 Topps",
      priceAmount: 2.49,
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: buildSession({
              mode: "duplicate_copy",
              targetGroupId: "11111111-1111-4111-8111-111111111111",
              targetVariationId: variation.variationId,
              copyConditionToken: "EXCELLENT",
              stickyPriceAmount: variation.priceAmount,
            }),
          }),
          {status: 200},
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({session: buildSession()}), {status: 200}));

    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({variations: [variation, otherVariation], variationCount: 2})]}
        refreshIntervalMs={0}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", {name: "Capture duplicate"})[0]);
    await act(async () => await Promise.resolve());
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        mode: "duplicate_copy",
        targetGroupId: "11111111-1111-4111-8111-111111111111",
        targetVariationId: variation.variationId,
        copyConditionToken: "EXCELLENT",
        stickyPriceAmount: 1.99,
      }),
    );
    expect(screen.getByText("Duplicate mode")).not.toBeNull();
    expect(screen.getByRole("button", {name: "Capture duplicate"})).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", {name: "Disarm"}));
    await act(async () => await Promise.resolve());
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({mode: "idle", targetGroupId: null, targetVariationId: null, copyConditionToken: null, stickyPriceAmount: 1.99}),
    );
  });

  it("defaults duplicate condition to the group and exposes only equal-or-better options", () => {
    const variation = buildVariation();
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({variations: [variation], conditionToken: "EXCELLENT"})]}
        refreshIntervalMs={0}
      />,
    );

    const selector = screen.getByRole("combobox", {name: "Duplicate-copy condition"}) as HTMLSelectElement;
    expect(selector.value).toBe("EXCELLENT");
    expect(Array.from(selector.options).map((option) => option.value)).toEqual([
      "NEAR_MINT_OR_BETTER",
      "EXCELLENT",
    ]);
  });

  it("sends the selected duplicate condition and hydrates a durable duplicate session", async () => {
    const variation = buildVariation();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: buildSession({
            mode: "duplicate_copy",
            targetGroupId: "11111111-1111-4111-8111-111111111111",
            targetVariationId: variation.variationId,
            copyConditionToken: "NEAR_MINT_OR_BETTER",
            stickyPriceAmount: variation.priceAmount,
          }),
        }),
        {status: 200},
      ),
    );

    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({variations: [variation], conditionToken: "EXCELLENT"})]}
        refreshIntervalMs={0}
      />,
    );

    const selector = screen.getByRole("combobox", {name: "Duplicate-copy condition"}) as HTMLSelectElement;
    fireEvent.change(selector, {target: {value: "NEAR_MINT_OR_BETTER"}});
    fireEvent.click(screen.getByRole("button", {name: "Capture duplicate"}));
    await act(async () => await Promise.resolve());

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        mode: "duplicate_copy",
        targetGroupId: "11111111-1111-4111-8111-111111111111",
        targetVariationId: variation.variationId,
        copyConditionToken: "NEAR_MINT_OR_BETTER",
        stickyPriceAmount: variation.priceAmount,
      }),
    );
    expect(selector.value).toBe("NEAR_MINT_OR_BETTER");
    expect(selector.disabled).toBe(true);
  });

  it("hydrates and locks the selector from an already armed durable duplicate session", () => {
    const variation = buildVariation();
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({conditionToken: "EXCELLENT", variations: [variation]})]}
        initialIntakeSession={buildSession({
          mode: "duplicate_copy",
          targetGroupId: "11111111-1111-4111-8111-111111111111",
          targetVariationId: variation.variationId,
          copyConditionToken: "NEAR_MINT_OR_BETTER",
        })}
        refreshIntervalMs={0}
      />,
    );

    const selector = screen.getByRole("combobox", {name: "Duplicate-copy condition"}) as HTMLSelectElement;
    expect(selector.value).toBe("NEAR_MINT_OR_BETTER");
    expect(selector.disabled).toBe(true);
  });

  it("fails closed when a group condition is unrecognized", () => {
    const variation = buildVariation();
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({conditionToken: "UNKNOWN_CONDITION", variations: [variation]})]}
        refreshIntervalMs={0}
      />,
    );

    expect(screen.getByText("Duplicate capture unavailable: bucket condition is unrecognized.")).not.toBeNull();
    expect(screen.getByRole("button", {name: "Capture duplicate"})).toHaveProperty("disabled", true);
  });

  it("shows and locks the frozen duplicate condition for a pending pair", () => {
    const variation = buildVariation();
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({conditionToken: "EXCELLENT", variations: [variation]})]}
        initialIntakeSession={buildSession({
          mode: "duplicate_copy",
          targetGroupId: "11111111-1111-4111-8111-111111111111",
          targetVariationId: variation.variationId,
          copyConditionToken: "NEAR_MINT_OR_BETTER",
          pendingPair: {
            pairId: "pair-duplicate",
            mode: "duplicate_copy",
            targetGroupId: "11111111-1111-4111-8111-111111111111",
            targetVariationId: variation.variationId,
            conditionToken: "NEAR_MINT_OR_BETTER",
            priceAmount: variation.priceAmount,
            priceCurrency: "USD",
            frontSourceRef: "/camera/front.jpg",
            startedAt: "2026-09-02T15:00:00.000Z",
            expectedDesiredRevision: 3,
          },
        })}
        refreshIntervalMs={0}
      />
    );

    const selector = screen.getByRole("combobox", {name: "Duplicate-copy condition"}) as HTMLSelectElement;
    expect(selector.value).toBe("NEAR_MINT_OR_BETTER");
    expect(selector.disabled).toBe(true);
    expect(screen.getByText("Frozen pending condition: Near Mint Or Better")).not.toBeNull();
  });

  it("rejects a second intake PATCH while the first configure is in flight", async () => {
    let resolveConfigure: ((response: Response) => void) | undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveConfigure = resolve;
      }),
    );
    render(<VariationListingsWorkspace initialGroups={[buildGroup()]} refreshIntervalMs={0} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "$1.49"}));
      fireEvent.click(screen.getByRole("button", {name: "$1.99"}));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveConfigure?.(new Response(JSON.stringify({session: buildSession({stickyPriceAmount: 1.49})}), {status: 200}));
      await Promise.resolve();
    });
  });

  it("does not let an older polling response overwrite a newer group revision", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({groups: [buildGroup({desiredRevision: 2, title: "Older group"})]}), {status: 200}),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({session: buildSession()}), {status: 200}));
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({desiredRevision: 3, title: "Newer group"})]}
        refreshIntervalMs={20}
      />,
    );

    await act(async () => await vi.advanceTimersByTimeAsync(20));
    expect(screen.getAllByText("Newer group").length).toBeGreaterThan(0);
    expect(screen.queryByText("Older group")).toBeNull();
  });

  it("renders copy inspection fields and replaces the group after representative CAS", async () => {
    const variation = buildVariation();
    const updatedVariation = buildVariation({
      representativeCopyId: "copy-2",
      copies: variation.copies.map((copy) => ({
        ...copy,
        isRepresentative: copy.copyId === "copy-2",
      })),
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(buildGroup({variations: [updatedVariation], variationCount: 1})), {status: 200}),
    );

    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({variations: [variation], variationCount: 1})]}
        refreshIntervalMs={0}
      />,
    );

    expect(screen.getAllByText("Near Mint Or Better").length).toBe(2);
    expect(screen.getByText("Light edge wear")).not.toBeNull();
    expect(screen.getAllByText("available").length).toBe(2);
    expect(screen.getByRole("img", {name: "Front image for copy copy-1"}).getAttribute("src")).toBe(
      "https://images.example/copy-1/front.jpg",
    );
    expect(screen.getByRole("img", {name: "Front image for copy copy-2"})).not.toBeNull();

    fireEvent.click(screen.getByRole("button", {name: "Use as representative"}));
    await act(async () => await Promise.resolve());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/variation-listings/11111111-1111-4111-8111-111111111111/variations/variation-1/representative-copy",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({expectedDesiredRevision: 3, copyId: "copy-2"}),
      }),
    );
    expect(screen.getByText("Representative")).not.toBeNull();
    expect(screen.getAllByRole("button", {name: "Use as representative"})).toHaveLength(1);
  });

  it("rejects a malformed representative response without replacing local state", async () => {
    const variation = buildVariation();
    const malformed = buildGroup({desiredRevision: -1, variations: [variation], variationCount: 1});
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(malformed), {status: 200}));
    render(
      <VariationListingsWorkspace
        initialGroups={[buildGroup({variations: [variation], variationCount: 1})]}
        refreshIntervalMs={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", {name: "Use as representative"}));
    await act(async () => await Promise.resolve());
    expect(screen.getByText("Representative copy update returned a malformed or mismatched group.")).not.toBeNull();
    expect(screen.getAllByRole("button", {name: "Use as representative"})).toHaveLength(1);
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
            conditionToken: null,
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
