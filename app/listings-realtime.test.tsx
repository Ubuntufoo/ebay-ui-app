import {act, cleanup, render, screen} from "@testing-library/react";
import {fireEvent} from "@testing-library/react";
import type {ComponentProps} from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const fetchMock = vi.fn();
const realtimeChannelSubscribeMock = vi.fn();
const realtimeChannelOnMock = vi.fn();
const realtimeSubscribeStatusCallbacks: Array<(status: string) => void> = [];
const realtimeChannel = {
  on: realtimeChannelOnMock,
  subscribe: realtimeChannelSubscribeMock,
};
const removeChannelMock = vi.fn();
const getSupabaseBrowserClientMock = vi.hoisted(() => vi.fn());
const {
  approveListingForExportMock,
  enqueueGenerateListingMock,
  retryPublishListingMock,
  saveListingEditsMock,
  saveListingImageUrlsMock,
} = vi.hoisted(() => ({
  approveListingForExportMock: vi.fn(),
  enqueueGenerateListingMock: vi.fn(),
  retryPublishListingMock: vi.fn(),
  saveListingEditsMock: vi.fn(),
  saveListingImageUrlsMock: vi.fn(),
}));

vi.mock("@/app/listing-generate-actions", () => ({
  enqueueGenerateListing: enqueueGenerateListingMock,
}));

vi.mock("@/app/listing-actions", () => ({
  saveListingEdits: saveListingEditsMock,
}));

vi.mock("@/app/listing-image-url-actions", () => ({
  saveListingImageUrls: saveListingImageUrlsMock,
}));

vi.mock("@/app/listing-approve-export-actions", () => ({
  approveListingForExport: approveListingForExportMock,
}));

vi.mock("@/app/listing-retry-publish-actions", () => ({
  retryPublishListingAction: retryPublishListingMock,
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: getSupabaseBrowserClientMock,
}));

import {ListingsRealtime} from "@/app/listings-realtime";

function buildListing(overrides: Partial<Listing> = {}): Listing {
  return {
    approved_for_export_at: null,
    capture_mode: null,
    category_id: null,
    condition_id: null,
    condition_notes: null,
    created_at: "2026-05-20T00:00:00.000Z",
    description: null,
    ebay_listing_id: null,
    ebay_listing_status: null,
    ebay_listing_url: null,
    ebay_offer_id: null,
    ese_eligible: null,
    estimated_weight_oz: null,
    exported_at: null,
    handling_days: null,
    id: "listing-row-id",
    image_urls: ["https://example.com/image.jpg"],
    item_specifics: {},
    last_error_at: null,
    last_error_code: null,
    last_error_message: null,
    listing_id: "LIST-001",
    listing_type: null,
    merchant_location_key: null,
    package_type: null,
    price: null,
    r2_delete_after: null,
    r2_deleted_at: null,
    r2_object_keys: [],
    r2_retention_policy: null,
    seller_hints: null,
    shipping_profile: null,
    sku: null,
    sold_at: null,
    status: "assets_ready",
    sub_status: "ready_to_generate",
    title: null,
    updated_at: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(listings: Listing[]) {
  return new Response(JSON.stringify({listings}), {
    headers: {"content-type": "application/json"},
    status: 200,
  });
}

function renderListingsRealtime(overrides: Partial<ComponentProps<typeof ListingsRealtime>> = {}) {
  return render(
    <ListingsRealtime
      initialListings={[buildListing()]}
      realtimeAnonKey="anon-key"
      realtimeDebounceMs={20}
      realtimeUrl="https://example.supabase.co"
      {...overrides}
    />,
  );
}

async function triggerDebouncedRealtimeEvent(
  handler: ((payload: unknown) => void) | undefined,
  eventType: "INSERT" | "UPDATE" | "DELETE",
) {
  act(() => {
    handler?.({eventType});
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
}

describe("ListingsRealtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    realtimeChannelOnMock.mockReset();
    realtimeChannelSubscribeMock.mockReset();
    removeChannelMock.mockReset();
    getSupabaseBrowserClientMock.mockReset();
    approveListingForExportMock.mockReset();
    enqueueGenerateListingMock.mockReset();
    saveListingEditsMock.mockReset();
    saveListingImageUrlsMock.mockReset();
    realtimeChannelOnMock.mockReturnValue(realtimeChannel);
    realtimeSubscribeStatusCallbacks.length = 0;
    realtimeChannelSubscribeMock.mockImplementation((callback?: (status: string) => void) => {
      if (callback) {
        realtimeSubscribeStatusCallbacks.push(callback);
      }

      return realtimeChannel;
    });
    getSupabaseBrowserClientMock.mockReturnValue({
      channel: vi.fn(() => realtimeChannel),
      removeChannel: removeChannelMock,
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not refetch while idle after initial render", async () => {
    fetchMock.mockResolvedValue(jsonResponse([buildListing()]));

    renderListingsRealtime();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(realtimeChannelOnMock).toHaveBeenCalledTimes(1);
    expect(realtimeChannelSubscribeMock).toHaveBeenCalledTimes(1);
    expect(realtimeChannelOnMock).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "listings",
      },
      expect.any(Function),
    );
  });

  it.each([
    "INSERT",
    "UPDATE",
    "DELETE",
  ] as const)("refreshes once for debounced %s listing events", async (eventType) => {
    const realtimePayloadHandlers: Array<(payload: unknown) => void> = [];
    realtimeChannelOnMock.mockImplementation((_event, _filter, callback) => {
      realtimePayloadHandlers.push(callback as (payload: unknown) => void);
      return realtimeChannel;
    });

    fetchMock.mockResolvedValue(
      jsonResponse([
        buildListing({
          ...(eventType === "DELETE"
            ? {}
            : {
                description: "Generated by Gemini.",
                item_specifics: {brand: "Topps", year: 2024},
                status: "needs_review",
                sub_status: "review_pending",
                title: "Gemini draft title",
                updated_at: "2026-05-20T02:00:00.000Z",
              }),
        }),
      ]),
    );

    renderListingsRealtime();

    expect(realtimePayloadHandlers).toHaveLength(1);

    await triggerDebouncedRealtimeEvent(
      realtimePayloadHandlers[0]
        ? (payload) => {
            realtimePayloadHandlers[0]?.(payload);
          }
        : undefined,
      eventType,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    if (eventType !== "DELETE") {
      expect(screen.getByRole("button", {name: "Review"})).not.toBeNull();

      fireEvent.click(screen.getByRole("button", {name: "Review"}));

      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
        "Gemini draft title",
      );
      expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe(
        "Generated by Gemini.",
      );
      expect(
        (screen.getByLabelText("Item specifics (JSON)") as HTMLTextAreaElement)
          .value,
      ).toBe(JSON.stringify({brand: "Topps", year: 2024}, null, 2));
    }
  });

  it("reconciles an open generating listing to needs_review after realtime refresh", async () => {
    const realtimePayloadHandlers: Array<(payload: unknown) => void> = [];
    realtimeChannelOnMock.mockImplementation((_event, _filter, callback) => {
      realtimePayloadHandlers.push(callback as (payload: unknown) => void);
      return realtimeChannel;
    });

    fetchMock.mockResolvedValue(
      jsonResponse([
        buildListing({
          description: "Generated by Gemini.",
          item_specifics: {brand: "Topps", year: 2024},
          status: "needs_review",
          sub_status: "review_pending",
          title: "Gemini draft title",
          updated_at: "2026-05-20T02:00:00.000Z",
        }),
      ]),
    );

    renderListingsRealtime({
      initialListings: [
        buildListing({
          status: "generating",
          sub_status: "ai_call_in_progress",
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", {name: "View"}));

    expect(
      screen.getByText(/AI generation is in progress\. Listing edits are locked/i),
    ).not.toBeNull();

    await triggerDebouncedRealtimeEvent(
      realtimePayloadHandlers[0]
        ? (payload) => {
            realtimePayloadHandlers[0]?.(payload);
          }
        : undefined,
      "UPDATE",
    );

    expect(screen.getByRole("button", {name: "Review"})).not.toBeNull();
    expect(
      screen.getByText(/Final review checklist/i),
    ).not.toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Gemini draft title",
    );
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe(
      "Generated by Gemini.",
    );
    expect(
      (screen.getByLabelText("Item specifics (JSON)") as HTMLTextAreaElement)
        .value,
    ).toBe(JSON.stringify({brand: "Topps", year: 2024}, null, 2));
  });

  it("closes an open listing when realtime refresh no longer returns that row", async () => {
    const realtimePayloadHandlers: Array<(payload: unknown) => void> = [];
    realtimeChannelOnMock.mockImplementation((_event, _filter, callback) => {
      realtimePayloadHandlers.push(callback as (payload: unknown) => void);
      return realtimeChannel;
    });

    fetchMock.mockResolvedValue(
      jsonResponse([
        buildListing({
          id: "listing-row-id-2",
          listing_id: "LIST-002",
          status: "needs_review",
          sub_status: "review_pending",
        }),
      ]),
    );

    renderListingsRealtime({
      initialListings: [
        buildListing({
          status: "generating",
          sub_status: "ai_call_in_progress",
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", {name: "View"}));
    expect(screen.getByText("Edit listing")).not.toBeNull();

    await triggerDebouncedRealtimeEvent(
      realtimePayloadHandlers[0]
        ? (payload) => {
            realtimePayloadHandlers[0]?.(payload);
          }
        : undefined,
      "DELETE",
    );

    expect(screen.queryByText("Edit listing")).toBeNull();
  });

  it("cleans up realtime subscription on unmount", async () => {
    const {unmount} = render(
      <ListingsRealtime
        initialListings={[buildListing()]}
        realtimeAnonKey="anon-key"
        realtimeUrl="https://example.supabase.co"
      />,
    );

    unmount();

    expect(removeChannelMock).toHaveBeenCalledWith(realtimeChannel);
  });

  it("reconciles once when the realtime subscription fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse([buildListing()]));

    renderListingsRealtime();

    act(() => {
      realtimeSubscribeStatusCallbacks[0]?.("CHANNEL_ERROR");
      realtimeSubscribeStatusCallbacks[0]?.("TIMED_OUT");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("queues one follow-up refresh when update lands mid-fetch", async () => {
    const realtimePayloadHandlers: Array<(payload: unknown) => void> = [];
    let releaseFetch: (() => void) | null = null;

    realtimeChannelOnMock.mockImplementation((_event, _filter, callback) => {
      realtimePayloadHandlers.push(callback as (payload: unknown) => void);
      return realtimeChannel;
    });

    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          releaseFetch = () => resolve(jsonResponse([buildListing()]));
        }),
    );

    renderListingsRealtime({realtimeDebounceMs: 10});

    act(() => {
      realtimePayloadHandlers[0]?.({eventType: "UPDATE"});
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      realtimePayloadHandlers[0]?.({eventType: "UPDATE"});
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFetch?.();
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
