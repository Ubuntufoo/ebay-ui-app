import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function buildListing(
  status: Listing["status"],
  imageUrls: string[] = ["https://example.com/image.jpg"],
): Listing {
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
    image_urls: imageUrls,
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
      screen.getByText(
        /AI generation is in progress\. Listing edits are locked/i,
      ),
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
    expect(
      screen.getByRole("button", {name: "Save image URLs"}),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", {name: "Assets ready"})).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", {name: "Needs review"})).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.queryByText("Final review checklist")).toBeNull();
    expect(
      screen.queryByRole("button", {name: "Approve For Export"}),
    ).toBeNull();
    expect(screen.queryByRole("link", {name: "130point"})).toBeNull();
    expect(screen.queryByRole("link", {name: "SportsCardsPro"})).toBeNull();
  });

  it("keeps assets_ready pre-generation fields editable and hides review fields", () => {
    render(
      <ListingEditForm
        listing={{
          ...buildListing("assets_ready", [
            "https://example.com/image-1.jpg",
            "https://example.com/image-2.jpg",
          ]),
          sub_status: "ready_to_generate",
        }}
      />,
    );

    expect(
      screen.getByText(
        /Pre-generation review\. Edit seller hints in Generate AI Draft above/i,
      ),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", {name: "Generate AI Draft"}),
    ).not.toBeNull();
    expect(screen.getByLabelText("Seller hints")).not.toBeNull();
    expect(screen.getByText("2 images")).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Open LIST-001 image 1"}),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Open LIST-001 image 2"}),
    ).not.toBeNull();
    expect(screen.queryByRole("button", {name: "Generating"})).toBeNull();
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByLabelText("Description")).toBeNull();
    expect(screen.queryByLabelText("Price")).toBeNull();
    expect(screen.queryByLabelText("Item specifics (JSON)")).toBeNull();
    expect(screen.queryByText("Final review checklist")).toBeNull();
    expect(
      screen.queryByRole("button", {name: "Approve For Export"}),
    ).toBeNull();
  });

  it("keeps normal edit behavior available for needs_review", async () => {
    const user = userEvent.setup();
    render(
      <ListingEditForm
        listing={buildListing("needs_review", [
          "https://example.com/review-image-1.jpg",
          "https://example.com/review-image-2.jpg",
        ])}
      />,
    );

    expect(
      screen.queryByText(
        /AI generation is in progress\. Listing edits are locked/i,
      ),
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
    expect(screen.getByText("2 images")).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Open LIST-001 image 1"}),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Open LIST-001 image 2"}),
    ).not.toBeNull();
    expect(screen.getByText("Final review checklist")).not.toBeNull();
    expect(
      screen.getByText(
        /Confirm each item before approving this listing for export\. This is a pre-publish safety gate\./i,
      ),
    ).not.toBeNull();

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });
    expect(approveButton).toHaveProperty("disabled", true);

    for (const checklistLabel of [
      "Title has been reviewed.",
      "Price has been reviewed.",
      "Category/aspects have been reviewed.",
      "Photos have been reviewed.",
      "Shipping/condition details have been reviewed.",
    ]) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", false);

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
