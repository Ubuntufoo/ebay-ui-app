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
    const openEditButtons = screen.getAllByRole("button", {name: "Open/Edit"});
    expect(viewButtons).toHaveLength(1);
    expect(openEditButtons).toHaveLength(1);

    await user.click(viewButtons[0]);

    expect(screen.getByText("Edit listing")).not.toBeNull();
    expect(
      screen.getByText(/AI generation is in progress\. Listing edits are locked/i),
    ).not.toBeNull();
    expect(screen.getByLabelText("Title")).toHaveProperty("disabled", true);
  });
});
