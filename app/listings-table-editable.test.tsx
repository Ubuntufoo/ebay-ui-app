import {cleanup, render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useState} from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {
  abandonListingActionMock,
  deleteSandboxListingActionMock,
  approveListingForExportMock,
  enqueueGenerateListingMock,
  retryPublishListingMock,
  saveListingEditsMock,
  saveListingImageUrlsMock,
  saveListingPricingModifierOptionsMock,
} = vi.hoisted(() => ({
  abandonListingActionMock: vi.fn(),
  deleteSandboxListingActionMock: vi.fn(),
  approveListingForExportMock: vi.fn(),
  enqueueGenerateListingMock: vi.fn(),
  retryPublishListingMock: vi.fn(),
  saveListingEditsMock: vi.fn(),
  saveListingImageUrlsMock: vi.fn(),
  saveListingPricingModifierOptionsMock: vi.fn(),
}));

vi.mock("@/app/listing-abandon-actions", () => ({
  abandonListingAction: abandonListingActionMock,
}));

vi.mock("@/app/listing-sandbox-delete-actions", () => ({
  deleteSandboxListingAction: deleteSandboxListingActionMock,
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
    auto_pricing_enabled: true,
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
    abandonListingActionMock.mockReset();
    deleteSandboxListingActionMock.mockReset();
    approveListingForExportMock.mockReset();
    enqueueGenerateListingMock.mockReset();
    saveListingEditsMock.mockReset();
    saveListingImageUrlsMock.mockReset();
    saveListingPricingModifierOptionsMock.mockReset();
    saveListingPricingModifierOptionsMock.mockResolvedValue({error: null});
  });

  it("renders active listings oldest-created first so new listings append at the bottom", () => {
    render(
      <ListingsTableEditable
        listings={[
          buildListing(
            "LIST-NEWEST",
            "needs_review",
            "2026-05-23T00:00:00.000Z",
            {
              created_at: "2026-05-22T00:00:00.000Z",
            },
          ),
          buildListing(
            "LIST-OLDEST",
            "needs_review",
            "2026-05-30T00:00:00.000Z",
            {
              created_at: "2026-05-20T00:00:00.000Z",
            },
          ),
          buildListing(
            "LIST-MIDDLE",
            "needs_review",
            "2026-05-21T00:00:00.000Z",
            {
              created_at: "2026-05-21T00:00:00.000Z",
            },
          ),
        ]}
      />,
    );

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("LIST-OLDEST"),
      expect.stringContaining("LIST-MIDDLE"),
      expect.stringContaining("LIST-NEWEST"),
    ]);
  });

  it("keeps published listings newest-first", () => {
    render(
      <ListingsTableEditable
        listings={[
          buildListing("PUB-OLDER", "exported", "2026-05-20T00:00:00.000Z", {
            created_at: "2026-05-19T00:00:00.000Z",
          }),
          buildListing("PUB-NEWER", "listed", "2026-05-22T00:00:00.000Z", {
            created_at: "2026-05-18T00:00:00.000Z",
          }),
        ]}
      />,
    );

    const publishedHeading = screen.getByText("Published Listings");
    const publishedSection = publishedHeading.closest("section");

    if (publishedSection === null) {
      throw new Error("Published Listings section not found.");
    }

    const rows = within(publishedSection).getAllByRole("row").slice(1);

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("PUB-NEWER"),
      expect.stringContaining("PUB-OLDER"),
    ]);
  });

  it("toggles expandable rows from non-interactive cells and switches selection", async () => {
    const user = userEvent.setup();
    render(
      <ListingsTableEditable
        listings={[
          buildListing("LIST-ONE", "needs_review", "2026-05-20T02:00:00.000Z", {
            title: "First listing title",
          }),
          buildListing("LIST-TWO", "assets_ready", "2026-05-20T01:00:00.000Z", {
            title: "Second listing title",
          }),
        ]}
      />,
    );

    const firstRow = screen
      .getByText("LIST-ONE")
      .closest("tr") as HTMLTableRowElement;
    const secondRow = screen
      .getByText("LIST-TWO")
      .closest("tr") as HTMLTableRowElement;

    await user.click(within(firstRow).getByText("LIST-ONE"));
    expect(screen.getByText("Edit listing")).not.toBeNull();

    await user.click(within(firstRow).getByText("First listing title"));
    expect(screen.queryByText("Edit listing")).toBeNull();

    await user.click(within(firstRow).getByText("Needs review"));
    expect(screen.getByText("Edit listing")).not.toBeNull();

    await user.click(firstRow.cells[4]);
    expect(screen.queryByText("Edit listing")).toBeNull();

    await user.click(within(firstRow).getByText("LIST-ONE"));
    await user.click(within(secondRow).getByText("Second listing title"));

    expect(screen.getAllByText("Edit listing")).toHaveLength(1);
    expect(screen.getByLabelText("Title")).toHaveProperty(
      "value",
      "Second listing title",
    );
  });

  it("generates an assets-ready draft from the Actions column without expanding", async () => {
    enqueueGenerateListingMock.mockResolvedValueOnce({
      error: null,
      info: null,
      success: "queued",
    });
    const user = userEvent.setup();

    render(
      <ListingsTableEditable
        listings={[
          buildListing(
            "LIST-READY",
            "assets_ready",
            "2026-05-20T01:00:00.000Z",
            {
              auto_pricing_enabled: false,
              seller_hints: "Use saved hints",
            },
          ),
        ]}
      />,
    );

    const row = screen
      .getByText("LIST-READY")
      .closest("tr") as HTMLTableRowElement;
    await user.click(
      within(row).getByRole("button", {name: "Generate AI Draft"}),
    );

    await waitFor(() => {
      expect(enqueueGenerateListingMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Edit listing")).toBeNull();

    const submittedFormData = enqueueGenerateListingMock.mock.calls[0]?.[1];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect((submittedFormData as FormData).get("listing_id")).toBe(
      "LIST-READY",
    );
    expect((submittedFormData as FormData).get("seller_hints")).toBe(
      "Use saved hints",
    );
    expect((submittedFormData as FormData).get("auto_pricing_enabled")).toBe(
      "false",
    );
  });

  it("duplicates export into Actions and collapses the editor from either export button", async () => {
    approveListingForExportMock.mockResolvedValue({
      error: null,
      success: "approved",
    });
    const user = userEvent.setup();

    render(
      <ListingsTableEditable
        listings={[
          buildListing(
            "LIST-REVIEW",
            "needs_review",
            "2026-05-20T01:00:00.000Z",
            {title: "Valid listing title"},
          ),
        ]}
      />,
    );

    const row = screen
      .getByText("LIST-REVIEW")
      .closest("tr") as HTMLTableRowElement;
    expect(
      within(row).getByRole("button", {name: "Approve For Export"}),
    ).not.toBeNull();

    await user.click(within(row).getByRole("button", {name: "Review"}));
    expect(
      screen.getAllByRole("button", {name: "Approve For Export"}),
    ).toHaveLength(2);

    await user.click(
      within(row).getByRole("button", {name: "Approve For Export"}),
    );

    await waitFor(() => {
      expect(approveListingForExportMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Edit listing")).toBeNull();

    await user.click(within(row).getByRole("button", {name: "Review"}));
    const exportButtons = screen.getAllByRole("button", {
      name: "Approve For Export",
    });
    await user.click(exportButtons[1]);

    await waitFor(() => {
      expect(approveListingForExportMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("Edit listing")).toBeNull();

    const submittedFormData = approveListingForExportMock.mock.calls[1]?.[1];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect((submittedFormData as FormData).get("listing_id")).toBe(
      "LIST-REVIEW",
    );
    expect((submittedFormData as FormData).get("current_status")).toBe(
      "needs_review",
    );
  });

  it("hides the Actions export button until export validation passes", async () => {
    const user = userEvent.setup();
    render(
      <ListingsTableEditable
        listings={[
          buildListing(
            "LIST-INVALID",
            "needs_review",
            "2026-05-20T01:00:00.000Z",
            {title: "X".repeat(81)},
          ),
        ]}
      />,
    );

    const row = screen
      .getByText("LIST-INVALID")
      .closest("tr") as HTMLTableRowElement;
    expect(
      within(row).queryByRole("button", {name: "Approve For Export"}),
    ).toBeNull();

    await user.click(within(row).getByRole("button", {name: "Review"}));

    const expandedExportButton = screen.getByRole("button", {
      name: "Approve For Export",
    });
    expect(expandedExportButton).toHaveProperty("disabled", true);
  });

  it("saves structured item specifics through the single Save edits action", async () => {
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});
    const user = userEvent.setup();

    render(
      <ListingsTableEditable
        listings={[
          buildListing(
            "LIST-SPECIFICS",
            "needs_review",
            "2026-05-20T01:00:00.000Z",
            {
              category_id: "261328",
              item_specifics: {
                Manufacturer: "Topps",
                Player: "Mike Trout",
              },
              title: "Valid listing title",
            },
          ),
        ]}
      />,
    );

    const row = screen
      .getByText("LIST-SPECIFICS")
      .closest("tr") as HTMLTableRowElement;
    await user.click(within(row).getByRole("button", {name: "Review"}));

    expect(
      screen.queryByRole("button", {name: "Save item specifics"}),
    ).toBeNull();

    const manufacturerInput = screen.getByRole("textbox", {
      name: /^Manufacturer\b/i,
    });
    await user.clear(manufacturerInput);
    await user.type(manufacturerInput, "Panini");
    await user.click(screen.getByRole("button", {name: "Save edits"}));

    expect(saveListingEditsMock).toHaveBeenCalledTimes(1);
    const submittedFormData = saveListingEditsMock.mock.calls[0]?.[1];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect(
      JSON.parse(
        String(
          (submittedFormData as FormData).get(
            "sports_card_specific_changes",
          ),
        ),
      ),
    ).toMatchObject({
      Manufacturer: "Panini",
      Material: "Card Stock",
      "Card Thickness": "20 Pt.",
      "Card Size": "Standard",
      Language: "English",
      "Original/Licensed Reprint": "Original",
      Vintage: "Yes",
    });
  });

  it("keeps intake rows read-only and active row actions vertically stacked", async () => {
    const user = userEvent.setup();
    render(
      <ListingsTableEditable
        listings={[
          buildListing(
            "LIST-INTAKE",
            "record_created",
            "2026-05-20T02:00:00.000Z",
          ),
          buildListing("LIST-REV", "needs_review", "2026-05-20T01:00:00.000Z"),
        ]}
      />,
    );

    const intakeRow = screen
      .getByText("LIST-INTAKE")
      .closest("tr") as HTMLTableRowElement;
    const reviewRow = screen
      .getByText("LIST-REV")
      .closest("tr") as HTMLTableRowElement;
    const intakeActions =
      within(intakeRow).getByText("Read only").parentElement;
    const reviewButton = within(reviewRow).getByRole("button", {
      name: "Review",
    });
    const abandonButton = within(reviewRow).getByRole("button", {
      name: "Abandon Listing",
    });
    const activeTable = screen.getByRole("table");
    const scrollContainer = activeTable.parentElement?.parentElement;
    const columnWidths = Array.from(
      activeTable.querySelectorAll("colgroup col"),
    ).map((column) => column.className);

    expect(intakeRow.className).not.toContain("cursor-pointer");
    await user.click(within(intakeRow).getByText("LIST-INTAKE"));
    expect(screen.queryByText("Edit listing")).toBeNull();

    expect(intakeActions?.className).toContain("flex-col");
    expect(reviewButton.parentElement?.className).toContain("flex-col");
    expect(reviewButton.className).toContain("whitespace-nowrap");
    expect(abandonButton.className).toContain("whitespace-nowrap");
    expect(scrollContainer?.style.scrollbarGutter).toBe("stable");
    expect(activeTable.className).toContain("table-fixed");
    expect(activeTable.className).toContain("min-w-[68rem]");
    expect(columnWidths).toEqual([
      "w-[12%]",
      "w-[11%]",
      "w-[11%]",
      "w-[16%]",
      "w-[16%]",
      "w-[7%]",
      "w-[11%]",
      "w-[16%]",
    ]);
  });

  it("keeps explicit controls and image links from toggling through the row", async () => {
    const user = userEvent.setup();
    render(
      <ListingsTableEditable
        listings={[
          buildListing("LIST-REV", "needs_review", "2026-05-20T01:00:00.000Z", {
            image_urls: ["https://example.com/review.jpg"],
          }),
        ]}
      />,
    );

    const reviewButton = screen.getByRole("button", {name: "Review"});
    await user.click(reviewButton);
    expect(screen.getByText("Edit listing")).not.toBeNull();

    await user.click(reviewButton);
    expect(screen.queryByText("Edit listing")).toBeNull();

    const imageLink = screen.getByRole("link", {name: "Open LIST-REV image 1"});
    imageLink.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    await user.click(imageLink);
    expect(screen.queryByText("Edit listing")).toBeNull();

    await user.click(screen.getByText("LIST-REV"));
    expect(screen.getByText("Edit listing")).not.toBeNull();

    await user.click(screen.getByRole("button", {name: "Abandon Listing"}));
    expect(
      screen.getByRole("dialog", {name: "Confirm Listing Abandonment"}),
    ).not.toBeNull();
    expect(screen.getByText("Edit listing")).not.toBeNull();
  });

  it("shows abandonment for every active row and enables abandonable statuses", () => {
    const statuses = [
      "record_created",
      "image_processing_queued",
      "images_processed",
      "assets_ready",
      "generating",
      "needs_review",
      "approved_for_export",
      "sold",
    ] as const;

    render(
      <ListingsTableEditable
        listings={statuses.map((status, index) =>
          buildListing(
            `LIST-${status}`,
            status,
            `2026-05-20T${String(index).padStart(2, "0")}:00:00.000Z`,
          ),
        )}
      />,
    );

    const buttons = screen.getAllByRole("button", {
      name: "Abandon Listing",
    });
    expect(buttons).toHaveLength(statuses.length);

    for (const status of statuses) {
      const row = screen.getByText(`LIST-${status}`).closest("tr");
      const button = within(row as HTMLTableRowElement).getByRole("button", {
        name: "Abandon Listing",
      });
      expect(button).toHaveProperty(
        "disabled",
        status !== "assets_ready" && status !== "needs_review",
      );
    }
  });

  it("opens the exact abandonment dialog for an enabled row", async () => {
    const user = userEvent.setup();
    render(
      <ListingsTableEditable
        listings={[
          buildListing("LIST-REV", "needs_review", "2026-05-20T01:00:00.000Z"),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", {name: "Abandon Listing"}));

    expect(
      screen.getByRole("dialog", {name: "Confirm Listing Abandonment"}),
    ).not.toBeNull();
  });

  it("removes an abandoned expanded row immediately", async () => {
    abandonListingActionMock.mockResolvedValueOnce({
      abandonedListingId: "LIST-REV",
      error: null,
      success: "Abandoned LIST-REV.",
    });
    const user = userEvent.setup();

    function Harness() {
      const [listings, setListings] = useState([
        buildListing("LIST-REV", "needs_review", "2026-05-20T01:00:00.000Z"),
      ]);

      return (
        <ListingsTableEditable
          listings={listings}
          onListingAbandoned={(listingId) =>
            setListings((current) =>
              current.filter((listing) => listing.listing_id !== listingId),
            )
          }
        />
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", {name: "Review"}));
    expect(screen.getByText("Edit listing")).not.toBeNull();

    await user.click(screen.getByRole("button", {name: "Abandon Listing"}));
    await user.click(screen.getByRole("button", {name: "Confirm"}));

    await waitFor(() => {
      expect(screen.queryByText("LIST-REV")).toBeNull();
    });
    expect(screen.queryByText("Edit listing")).toBeNull();
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
    // One quick-action button per assets_ready row (LIST-FALSE, LIST-READY)
    // plus the inline Generate AI Draft control in the opened edit panel.
    expect(
      screen.getAllByRole("button", {name: "Generate AI Draft"}),
    ).toHaveLength(3);
    expect(
      screen.getByRole("checkbox", {name: "Pre-filter graded comps"}),
    ).toHaveProperty("checked", true);
    expect(
      screen.getByRole("checkbox", {name: "Avoid autographs"}),
    ).toHaveProperty("checked", true);
    expect(screen.getAllByLabelText("Seller hints").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Title")).not.toBeNull();
  });

  it("moves exported and listed listings into a non-clickable Published Listings panel", async () => {
    const user = userEvent.setup();
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
            "exported",
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
          buildListing("LIST-ARCHIVE", "exported", "2026-05-20T08:00:00.000Z", {
            ebay_listing_url: "https://www.ebay.com/itm/987654321",
            exported_at: "2026-05-20T07:45:00.000Z",
            title: "Archived exported listing",
          }),
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

    const publishedRow = exportedPanel
      .getByText("Exported listing")
      .closest("tr") as HTMLTableRowElement;
    expect(publishedRow.className).not.toContain("cursor-pointer");
    await user.click(exportedPanel.getByText("Exported listing"));
    expect(screen.queryByText("Edit listing")).toBeNull();
  });

  it("shows sandbox-only actions and disables rows without a safe structured SKU", async () => {
    const user = userEvent.setup();
    render(
      <ListingsTableEditable
        ebayEnvironment="sandbox"
        listings={[
          buildListing(
            "Single-000005",
            "exported",
            "2026-07-30T18:43:17.000Z",
            {
              sku: "BSKBL-Single-000005",
              title: "Safe sandbox listing",
            },
          ),
          buildListing("Lot-000006", "listed", "2026-07-30T18:44:17.000Z", {
            sku: "legacy-sku",
            title: "Unsafe SKU listing",
          }),
          buildListing(
            "Single-000007",
            "exported",
            "2026-07-30T18:45:17.000Z",
            {
              sku: "OTHER-Single-000007",
              sold_at: "2026-07-30T19:00:00.000Z",
              title: "Sold sandbox listing",
            },
          ),
        ]}
      />,
    );

    expect(screen.getByRole("columnheader", {name: "Actions"})).not.toBeNull();
    const buttons = screen.getAllByRole("button", {
      name: "Delete Sandbox Listing",
    });
    expect(buttons).toHaveLength(3);

    const validButton = within(
      screen
        .getByText("Safe sandbox listing")
        .closest("tr") as HTMLTableRowElement,
    ).getByRole("button", {name: "Delete Sandbox Listing"});
    expect(validButton).toHaveProperty("disabled", false);

    const invalidSkuButton = within(
      screen
        .getByText("Unsafe SKU listing")
        .closest("tr") as HTMLTableRowElement,
    ).getByRole("button", {name: "Delete Sandbox Listing"});
    expect(invalidSkuButton).toHaveProperty("disabled", true);
    expect(invalidSkuButton.getAttribute("title")).toContain("structured SKU");

    const soldButton = within(
      screen
        .getByText("Sold sandbox listing")
        .closest("tr") as HTMLTableRowElement,
    ).getByRole("button", {name: "Delete Sandbox Listing"});
    expect(soldButton).toHaveProperty("disabled", true);

    await user.click(validButton);
    expect(
      screen.getByRole("dialog", {name: "Confirm Sandbox Listing Deletion"}),
    ).not.toBeNull();
    expect(screen.queryByText("Edit listing")).toBeNull();
  });

  it.each(["production", null] as const)(
    "fails closed when eBay environment is %s",
    (ebayEnvironment) => {
      render(
        <ListingsTableEditable
          ebayEnvironment={ebayEnvironment}
          listings={[
            buildListing(
              "Single-000005",
              "exported",
              "2026-07-30T18:43:17.000Z",
              {sku: "BSKBL-Single-000005"},
            ),
          ]}
        />,
      );

      expect(screen.queryByRole("columnheader", {name: "Actions"})).toBeNull();
      expect(
        screen.queryByRole("button", {name: "Delete Sandbox Listing"}),
      ).toBeNull();
    },
  );
});
