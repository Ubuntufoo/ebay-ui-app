import {cleanup, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {enqueueGenerateListingMock, saveListingPricingModifierOptionsMock} =
  vi.hoisted(() => ({
    enqueueGenerateListingMock: vi.fn(),
    saveListingPricingModifierOptionsMock: vi.fn(),
  }));

vi.mock("@/app/listing-generate-actions", () => ({
  enqueueGenerateListing: enqueueGenerateListingMock,
  saveListingPricingModifierOptions: saveListingPricingModifierOptionsMock,
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
    saveListingPricingModifierOptionsMock.mockReset();
    saveListingPricingModifierOptionsMock.mockResolvedValue({error: null});
  });

  it("shows Generate only for assets_ready", () => {
    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    expect(
      screen.getByRole("button", {name: "Generate AI Draft"}),
    ).not.toBeNull();
    expect(screen.getByLabelText("Seller hints")).not.toBeNull();
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

    expect(
      screen.queryByRole("button", {name: "Generate AI Draft"}),
    ).toBeNull();
  });

  it("submits listing id and shows pending state", async () => {
    const deferred = createDeferred<{
      error: string | null;
      info: string | null;
      success: string | null;
    }>();
    enqueueGenerateListingMock.mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup();

    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    const sellerHints = screen.getByLabelText("Seller hints");
    await user.type(sellerHints, "Use padded envelope");
    await user.click(screen.getByRole("button", {name: "Generate AI Draft"}));

    expect(enqueueGenerateListingMock).toHaveBeenCalled();
    const submittedFormData = enqueueGenerateListingMock.mock
      .calls[0]?.[1] as FormData;
    expect(submittedFormData.get("listing_id")).toBe("LIST-001");
    expect(submittedFormData.get("seller_hints")).toBe("Use padded envelope");
    expect(submittedFormData.get("exclude_graded")).toBe("true");
    expect(submittedFormData.get("exclude_autographs")).toBe("true");
    expect(submittedFormData.get("exclude_variants")).toBe("false");

    await waitFor(() => {
      const button = screen.getByRole("button", {name: "Generating..."});
      expect(button).not.toBeNull();
      expect(button).toHaveProperty("disabled", true);
    });

    expect(screen.getByLabelText("Seller hints")).toHaveProperty(
      "disabled",
      true,
    );

    deferred.resolve({
      error: null,
      info: null,
      success: "Queued Generate AI Draft for LIST-001. Listing now Generating.",
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Queued Generate AI Draft for LIST-001. Listing now Generating.",
        ),
      ).not.toBeNull();
    });
  });

  it("shows enqueue errors", async () => {
    enqueueGenerateListingMock.mockResolvedValueOnce({
      info: null,
      error: "queue failed",
      success: null,
    });
    const user = userEvent.setup();

    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    await user.click(screen.getByRole("button", {name: "Generate AI Draft"}));

    const error = await screen.findByText("queue failed");
    expect(error).not.toBeNull();
  });

  it("renders backend-equivalent modifier defaults when missing", () => {
    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    expect(
      screen.getByRole("checkbox", {name: "Pre-filter graded comps"}),
    ).toHaveProperty("checked", true);
    expect(
      screen.getByRole("checkbox", {name: "Avoid autographs"}),
    ).toHaveProperty("checked", true);
  });

  it("hydrates partial persisted modifier values", () => {
    render(
      <ListingGenerateControls
        listing={{
          ...buildListing("assets_ready"),
          item_specifics: {
            pricingModifierOptions: {
              excludeGraded: false,
              excludeVariants: true,
            },
          },
        }}
      />,
    );

    expect(
      screen.getByRole("checkbox", {name: "Pre-filter graded comps"}),
    ).toHaveProperty("checked", false);
    expect(
      screen.getByRole("checkbox", {name: "Avoid autographs"}),
    ).toHaveProperty("checked", true);
  });

  it("persists toggled modifier choices per listing", async () => {
    const user = userEvent.setup();

    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    await user.click(
      screen.getByRole("checkbox", {name: "Pre-filter graded comps"}),
    );

    expect(saveListingPricingModifierOptionsMock).toHaveBeenCalledWith(
      "LIST-001",
      {
        auto: true,
        graded: false,
        variant: false,
      },
    );
  });

  it("hides variant toggle from visible UI", () => {
    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    expect(screen.queryByRole("checkbox", {name: "+Variant"})).toBeNull();
  });

  it("renders help text for graded/slabbed exclusions", () => {
    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    expect(screen.getByText(/core provider negatives/)).not.toBeNull();
    expect(
      screen.getByText(
        /always removed after results return, even when this toggle is off/,
      ),
    ).not.toBeNull();
  });

  it("preserves variant hidden input value from stored item specifics", () => {
    const {container} = render(
      <ListingGenerateControls
        listing={{
          ...buildListing("assets_ready"),
          item_specifics: {
            pricingModifierOptions: {
              excludeVariants: true,
            },
          },
        }}
      />,
    );

    const hiddenInput = container.querySelector(
      'input[name="exclude_variants"]',
    ) as HTMLInputElement | null;

    expect(hiddenInput).not.toBeNull();
    expect(hiddenInput?.value).toBe("true");
  });

  it("shows info for already queued listings", async () => {
    enqueueGenerateListingMock.mockResolvedValueOnce({
      error: null,
      info: "Generate AI Draft already queued or running for LIST-001. Listing now Generating.",
      success: null,
    });
    const user = userEvent.setup();

    render(<ListingGenerateControls listing={buildListing("assets_ready")} />);

    await user.click(screen.getByRole("button", {name: "Generate AI Draft"}));

    const info = await screen.findByText(
      "Generate AI Draft already queued or running for LIST-001. Listing now Generating.",
    );
    expect(info).not.toBeNull();
  });
});
