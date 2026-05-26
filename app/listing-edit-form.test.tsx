import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {
  approveListingForExportMock,
  enqueueGenerateListingMock,
  saveListingEditsMock,
  saveListingImageUrlsMock,
  updateListingStatusMock,
} = vi.hoisted(() => ({
  approveListingForExportMock: vi.fn(),
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

vi.mock("@/app/listing-approve-export-actions", () => ({
  approveListingForExport: approveListingForExportMock,
}));

import {ListingEditForm} from "@/app/listing-edit-form";

function buildListing(status: Listing["status"]): Listing {
  return {
    approved_for_export_at: null,
    capture_mode: null,
    category_id: "CAT-1",
    condition_id: "COND-1",
    condition_notes: "Visible notes",
    created_at: "2026-05-20T00:00:00.000Z",
    description: "Visible description",
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
    item_specifics: {
      "Card Number": "1",
      Player: "Mike Trout",
      Set: "Topps Chrome",
      Year: "2023",
    },
    last_error_at: null,
    last_error_code: null,
    listing_id: "LIST-001",
    listing_type: null,
    merchant_location_key: null,
    package_type: null,
    price: 42,
    r2_delete_after: null,
    r2_deleted_at: null,
    r2_object_keys: [],
    r2_retention_policy: null,
    seller_hints: "Visible hints",
    shipping_profile: null,
    sku: null,
    sold_at: null,
    status,
    sub_status: "idle",
    title: "2023 Mike Trout Topps Chrome Rookie Card",
    updated_at: "2026-05-20T00:00:00.000Z",
  };
}

describe("ListingEditForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    approveListingForExportMock.mockReset();
    enqueueGenerateListingMock.mockReset();
    saveListingEditsMock.mockReset();
    saveListingImageUrlsMock.mockReset();
    updateListingStatusMock.mockReset();
  });

  it("locks edit controls and shows generating notice while generating", () => {
    render(<ListingEditForm listing={buildListing("generating")} />);

    expect(
      screen.getByText(/AI generation is in progress\. Listing edits are locked/i),
    ).not.toBeNull();

    for (const label of [
      "Title",
      "Seller hints",
      "Description",
      "Price",
      "Category ID",
      "Condition ID",
      "Condition notes",
      "Item specifics (JSON)",
      "Manual image URLs",
    ]) {
      expect(screen.getByLabelText(label)).toHaveProperty("disabled", true);
    }

    expect(screen.getByRole("button", {name: "Save edits"})).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", {name: "Save image URLs"})).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", {name: "Assets ready"})).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", {name: "Needs review"})).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.queryByRole("link", {name: "130point"})).toBeNull();
    expect(screen.queryByRole("link", {name: "SportsCardsPro"})).toBeNull();
  });

  it("keeps normal edit behavior available for needs_review", () => {
    render(<ListingEditForm listing={buildListing("needs_review")} />);

    expect(
      screen.queryByText(/AI generation is in progress\. Listing edits are locked/i),
    ).toBeNull();
    expect(
      screen.getByText(
        /AI draft ready for review\. Confirm or edit the generated fields before approving for export\./i,
      ),
    ).not.toBeNull();

    expect(screen.getByLabelText("Title")).toHaveProperty("disabled", false);
    expect(screen.getByLabelText("Item specifics (JSON)")).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("button", {name: "Save edits"})).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.queryByRole("button", {name: "Generate"})).toBeNull();
    expect(screen.getByRole("button", {name: "Assets ready"})).toHaveProperty(
      "disabled",
      false,
    );

    expect(
      screen.getByRole("link", {name: "130point"}).getAttribute("href"),
    ).toContain("130point.com/search#q=");
    expect(
      screen.getByRole("link", {name: "130point"}).getAttribute("target"),
    ).toBe("_blank");
    expect(
      screen.getByRole("link", {name: "SportsCardsPro"}).getAttribute("href"),
    ).toContain("sportscardspro.com/search-products?q=");
    expect(
      screen.getByRole("link", {name: "SportsCardsPro"}).getAttribute("href"),
    ).toContain("type=prices");
  });
});
