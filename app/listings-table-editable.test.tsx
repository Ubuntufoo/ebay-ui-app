import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {
  enqueueGenerateListingMock,
  saveListingEditsMock,
  saveListingImageUrlsMock,
  updateListingStatusMock,
} = vi.hoisted(() => ({
  enqueueGenerateListingMock: vi.fn(),
  saveListingEditsMock: vi.fn(),
  saveListingImageUrlsMock: vi.fn(),
  updateListingStatusMock: vi.fn(),
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

vi.mock("@/app/listing-status-actions", () => ({
  updateListingStatus: updateListingStatusMock,
}));

import {ListingsTableEditable} from "@/app/listings-table-editable";

function buildListing(
  listingId: string,
  status: Listing["status"],
  updatedAt: string,
  overrides: Partial<Listing> = {},
): Listing {
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
    id: `${listingId}-row-id`,
    image_urls: [],
    item_specifics: {},
    last_error_at: null,
    last_error_code: null,
    last_error_message: null,
    listing_id: listingId,
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
    updated_at: updatedAt,
    ...overrides,
  };
}

describe("ListingsTableEditable", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    enqueueGenerateListingMock.mockReset();
    saveListingEditsMock.mockReset();
    saveListingImageUrlsMock.mockReset();
    updateListingStatusMock.mockReset();
  });

  it("allows viewing generating listings but keeps controls locked", async () => {
    const user = userEvent.setup();

    render(
      <ListingsTableEditable
        listings={[
          buildListing("LIST-GEN", "generating", "2026-05-20T00:00:00.000Z"),
          buildListing("LIST-REV", "needs_review", "2026-05-20T01:00:00.000Z"),
        ]}
      />,
    );

    const viewButtons = screen.getAllByRole("button", {name: "View"});
    const reviewButtons = screen.getAllByRole("button", {name: "Review"});
    expect(viewButtons).toHaveLength(1);
    expect(reviewButtons).toHaveLength(1);

    await user.click(viewButtons[0]);

    expect(screen.getByText("Edit listing")).not.toBeNull();
    expect(
      screen.getByText(/AI generation is in progress\. Listing edits are locked/i),
    ).not.toBeNull();
    expect(screen.getByLabelText("Title")).toHaveProperty("disabled", true);
  });

  it("shows review-ready listings with editable controls and no generate action", async () => {
    const user = userEvent.setup();

    render(
      <ListingsTableEditable
        listings={[buildListing("LIST-REV", "needs_review", "2026-05-20T01:00:00.000Z")]}
      />,
    );

    await user.click(screen.getByRole("button", {name: "Review"}));

    expect(screen.getByText("Edit listing")).not.toBeNull();
    expect(
      screen.getByText(
        /AI draft ready for review\. Confirm or edit the generated fields before approving for export\./i,
      ),
    ).not.toBeNull();
    expect(screen.getByLabelText("Title")).toHaveProperty("disabled", false);
    expect(screen.queryByRole("button", {name: "Generate"})).toBeNull();
  });

  it("renders intake rows, safe local image placeholders, and error details", () => {
    render(
      <ListingsTableEditable
        listings={[
          buildListing("LIST-LOCAL", "record_created", "2026-05-20T02:00:00.000Z", {
            image_urls: ["/Users/test/local-1.jpg", "/Users/test/local-2.jpg"],
            last_error_code: "r2_upload_failed",
            last_error_message: "Could not upload intake images.",
            sub_status: "waiting_for_r2_upload",
          }),
          buildListing("LIST-READY", "assets_ready", "2026-05-20T03:00:00.000Z", {
            image_urls: [
              "/Users/test/local-3.jpg",
              "https://example.com/photo.jpg",
            ],
            sub_status: "processing_images",
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("Intake created").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Assets ready").length).toBeGreaterThan(0);
    expect(screen.getByText("Local images pending upload")).not.toBeNull();
    expect(screen.getAllByText("2 images")).toHaveLength(2);
    expect(screen.getByRole("img", {name: "LIST-READY image 1"})).not.toBeNull();
    expect(screen.getByText("Needs attention")).not.toBeNull();
    expect(screen.getByText("r2_upload_failed")).not.toBeNull();
    expect(screen.getByText("Could not upload intake images.")).not.toBeNull();
    expect(screen.queryByRole("button", {name: "Open/Edit"})).toBeNull();
  });
});
