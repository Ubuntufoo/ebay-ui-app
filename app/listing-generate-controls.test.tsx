import {cleanup, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {enqueueGenerateListingMock} = vi.hoisted(() => ({
  enqueueGenerateListingMock: vi.fn(),
}));

vi.mock("@/app/listing-generate-actions", () => ({
  enqueueGenerateListing: enqueueGenerateListingMock,
}));

import {ListingGenerateControls} from "@/app/listing-generate-controls";

function buildListing(status: Listing["status"]): Listing {
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
    status,
    sub_status: "idle",
    title: null,
    updated_at: "2026-05-20T00:00:00.000Z",
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return {promise, resolve};
}

describe("ListingGenerateControls", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    enqueueGenerateListingMock.mockReset();
  });

  it("shows Generate only for assets_ready", () => {
    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    expect(screen.getByRole("button", {name: "Generate"})).not.toBeNull();
  });

  it.each([
    "record_created",
    "image_processing_queued",
    "images_processed",
    "generating",
    "needs_review",
    "approved_for_export",
    "listed",
    "sold",
  ] as const)("hides Generate for %s", (status) => {
    render(<ListingGenerateControls listing={buildListing(status)} />);

    expect(screen.queryByRole("button", {name: "Generate"})).toBeNull();
  });

  it("submits listing id and shows pending state", async () => {
    const deferred = createDeferred<{error: string | null; success: string | null}>();
    enqueueGenerateListingMock.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();

    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    await user.click(screen.getByRole("button", {name: "Generate"}));

    expect(enqueueGenerateListingMock).toHaveBeenCalled();
    const submittedFormData = enqueueGenerateListingMock.mock.calls[0]?.[1] as FormData;
    expect(submittedFormData.get("listing_id")).toBe("LIST-001");

    await waitFor(() => {
      const button = screen.getByRole("button", {name: "Generating..."});
      expect(button).not.toBeNull();
      expect(button).toHaveProperty("disabled", true);
    });

    deferred.resolve({error: null, success: "Queued generate_ai."});
  });

  it("shows enqueue errors", async () => {
    enqueueGenerateListingMock.mockResolvedValueOnce({
      error: "queue failed",
      success: null,
    });
    const user = userEvent.setup();

    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    await user.click(screen.getByRole("button", {name: "Generate"}));

    const error = await screen.findByText("queue failed");
    expect(error).not.toBeNull();
  });
});
