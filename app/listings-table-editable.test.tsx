import {cleanup, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {
  approveListingForExportMock,
  enqueueGenerateListingMock,
  retryPublishListingMock,
  saveListingEditsMock,
  saveListingImageUrlsMock,
  saveListingPricingModifierOptionsMock,
} = vi.hoisted(() => ({
  approveListingForExportMock: vi.fn(),
  enqueueGenerateListingMock: vi.fn(),
  retryPublishListingMock: vi.fn(),
  saveListingEditsMock: vi.fn(),
  saveListingImageUrlsMock: vi.fn(),
  saveListingPricingModifierOptionsMock: vi.fn(),
}));

vi.mock("@/app/listing-generate-actions", () => ({
  enqueueGenerateListing: enqueueGenerateListingMock,
  saveListingPricingModifierOptions: saveListingPricingModifierOptionsMock,
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
    approveListingForExportMock.mockReset();
    enqueueGenerateListingMock.mockReset();
    saveListingEditsMock.mockReset();
    saveListingImageUrlsMock.mockReset();
    saveListingPricingModifierOptionsMock.mockReset();
    saveListingPricingModifierOptionsMock.mockResolvedValue({error: null});
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
      screen.getByText(
        /AI generation is in progress\. Listing edits are locked/i,
      ),
    ).not.toBeNull();
    expect(screen.getByLabelText("Title")).toHaveProperty("disabled", true);
  });

  it("shows review-ready listings with editable controls and no generate action", async () => {
    const user = userEvent.setup();

    render(
      <ListingsTableEditable
        listings={[
          buildListing("LIST-REV", "needs_review", "2026-05-20T01:00:00.000Z"),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", {name: "Review"}));

    expect(screen.getByText("Edit listing")).not.toBeNull();
    expect(screen.getByLabelText("Title")).toHaveProperty("disabled", false);
    expect(screen.queryByRole("button", {name: "Generate"})).toBeNull();
  });

  it("renders intake rows, safe local image placeholders, and editable assets_ready rows", async () => {
    const user = userEvent.setup();

    render(
      <ListingsTableEditable
        listings={[
          buildListing(
            "LIST-LOCAL",
            "record_created",
            "2026-05-20T02:00:00.000Z",
            {
              image_urls: [
                "/Users/test/local-1.jpg",
                "/Users/test/local-2.jpg",
              ],
              last_error_code: "r2_upload_failed",
              last_error_message: "Could not upload intake images.",
              sub_status: "waiting_for_r2_upload",
            },
          ),
          buildListing(
            "LIST-FALSE",
            "assets_ready",
            "2026-05-20T02:30:00.000Z",
            {
              image_urls: ["https://example.com/faux.jpg"],
              last_error_context: {},
              sub_status: "ready_to_generate",
            },
          ),
          buildListing(
            "LIST-READY",
            "assets_ready",
            "2026-05-20T03:00:00.000Z",
            {
              image_urls: [
                "/Users/test/local-3.jpg",
                "https://example.com/photo.jpg",
              ],
              sub_status: "ready_to_generate",
            },
          ),
        ]}
      />,
    );

    expect(screen.getAllByText("Intake created").length).toBeGreaterThan(0);
    expect(screen.queryByText("Local images pending upload")).toBeNull();
    expect(
      screen.getByRole("img", {name: "LIST-READY image 2"}),
    ).not.toBeNull();
    expect(screen.getByText("Needs attention")).not.toBeNull();
    expect(screen.getByText("r2_upload_failed")).not.toBeNull();
    expect(screen.queryByText("Could not upload intake images.")).toBeNull();
    expect(
      within(
        screen.getByText("LIST-FALSE").closest("tr") as HTMLTableRowElement,
      ).queryByText("Needs attention"),
    ).toBeNull();

    const openEditButton = within(
      screen.getByText("LIST-READY").closest("tr") as HTMLTableRowElement,
    ).getByRole("button", {name: "Open/Edit"});
    await user.click(openEditButton);

    expect(screen.getByText("Edit listing")).not.toBeNull();
    expect(
      screen.getByRole("button", {name: "Generate AI Draft"}),
    ).not.toBeNull();
    expect(screen.getByRole("checkbox", {name: "-Graded"})).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("checkbox", {name: "-Auto"})).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("checkbox", {name: "+Variant"})).toHaveProperty(
      "checked",
      false,
    );
    expect(screen.getAllByLabelText("Seller hints").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Title")).not.toBeNull();
  });

  it("moves exported and listed listings into the Published Listings panel", () => {
    render(
      <ListingsTableEditable
        listings={[
          buildListing(
            "LIST-ACTIVE",
            "needs_review",
            "2026-05-20T04:00:00.000Z",
            {
              image_urls: ["https://example.com/active.jpg"],
              title: "Active workflow listing",
            },
          ),
          buildListing(
            "LIST-EXPORTED",
            "exported" as Listing["status"],
            "2026-05-20T06:00:00.000Z",
            {
              ebay_listing_url: "https://www.ebay.com/itm/123456789",
              exported_at: "2026-05-20T05:45:00.000Z",
              image_urls: ["https://example.com/exported.jpg"],
              sku: "SKU-EXPORTED",
              title: "Exported listing",
            },
          ),
          buildListing("LIST-LISTED", "listed", "2026-05-20T07:00:00.000Z", {
            ebay_listing_url: null,
            exported_at: "2026-05-20T06:30:00.000Z",
            title: "Listed listing",
          }),
          buildListing(
            "LIST-ARCHIVE",
            "exported" as Listing["status"],
            "2026-05-20T08:00:00.000Z",
            {
              ebay_listing_url: "https://www.ebay.com/itm/987654321",
              exported_at: "2026-05-20T07:45:00.000Z",
              title: "Archived exported listing",
            },
          ),
        ]}
      />,
    );

    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(2);

    const activeTable = tables[0];
    expect(
      within(activeTable).getByRole("button", {name: "Review"}),
    ).not.toBeNull();
    expect(within(activeTable).queryByText("Exported listing")).toBeNull();
    expect(within(activeTable).queryByText("Listed listing")).toBeNull();
    expect(
      within(activeTable).queryByText("Archived exported listing"),
    ).toBeNull();

    const exportedPanelHeading = screen.getByRole("heading", {
      name: "Published Listings",
    });
    const exportedPanel = within(
      exportedPanelHeading.closest("section") as HTMLElement,
    );

    expect(exportedPanel.getByText("Exported listing")).not.toBeNull();
    expect(exportedPanel.getByText("Listed listing")).not.toBeNull();
    expect(exportedPanel.getByText("Archived exported listing")).not.toBeNull();
    expect(
      exportedPanel.getByText("Exported listing").closest("tr")?.textContent,
    ).toContain("LIST-EXPORTED / SKU-EXPORTED");
    expect(
      exportedPanel
        .getAllByRole("link", {name: "Open"})
        .find(
          (link) =>
            link.getAttribute("href") === "https://www.ebay.com/itm/123456789",
        ),
    ).not.toBeUndefined();
    expect(exportedPanel.queryByRole("button")).toBeNull();
    expect(exportedPanel.queryByRole("img")).toBeNull();
    expect(
      exportedPanel
        .getByText("Listed listing")
        .closest("tr")
        ?.querySelector("a"),
    ).toBeNull();
  });
});
