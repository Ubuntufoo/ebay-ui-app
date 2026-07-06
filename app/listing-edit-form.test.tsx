import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {
  approveListingForExportMock,
  enqueueGenerateListingMock,
  retryListingPricingMock,
  retryPublishListingMock,
  saveListingEditsMock,
  saveListingImageUrlsMock,
} = vi.hoisted(() => ({
  approveListingForExportMock: vi.fn(),
  enqueueGenerateListingMock: vi.fn(),
  retryListingPricingMock: vi.fn(),
  retryPublishListingMock: vi.fn(),
  saveListingEditsMock: vi.fn(),
  saveListingImageUrlsMock: vi.fn(),
}));

vi.mock("@/app/listing-generate-actions", () => ({
  enqueueGenerateListing: enqueueGenerateListingMock,
  retryListingPricing: retryListingPricingMock,
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

import {ListingEditForm} from "@/app/listing-edit-form";

const FIRST_LIVE_REVIEW_CHECKLIST_LABELS = [
  "Title is accurate and eBay-safe.",
  "Price is correct.",
  "Category is correct.",
  "Condition is correct.",
  "Images are correct and ordered front/back or lot sequence.",
  "Item specifics look correct.",
] as const;

function buildListing(
  status: Listing["status"],
  imageUrls: string[] = ["https://example.com/image.jpg"],
  overrides: Partial<Listing> = {},
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
    last_error_context: null,
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
    ...overrides,
  };
}

describe("ListingEditForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    approveListingForExportMock.mockReset();
    enqueueGenerateListingMock.mockReset();
    retryListingPricingMock.mockReset();
    retryPublishListingMock.mockReset();
    saveListingEditsMock.mockReset();
    saveListingImageUrlsMock.mockReset();
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
      "Card Condition",
      "Item specifics (JSON)",
    ]) {
      expect(screen.getByLabelText(label)).toHaveProperty("disabled", true);
    }

    expect(screen.getByRole("button", {name: "Save edits"})).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.queryByRole("button", {name: "Assets ready"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Needs review"})).toBeNull();
    expect(screen.queryByText("Final review checklist")).toBeNull();
    expect(
      screen.queryByRole("button", {name: "Approve For Export"}),
    ).toBeNull();
    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();
    expect(screen.queryByRole("link", {name: "130point"})).toBeNull();
    expect(screen.queryByRole("link", {name: "SportsCardsPro"})).toBeNull();
  });

  it("keeps assets_ready pre-generation fields editable and hides review fields", () => {
    render(
      <ListingEditForm
        listing={{
          ...buildListing(
            "assets_ready",
            [
              "https://example.com/image-1.jpg",
              "https://example.com/image-2.jpg",
            ],
            {
              title: "A".repeat(81),
            },
          ),
          sub_status: "ready_to_generate",
        }}
      />,
    );

    expect(
      screen.getByRole("button", {name: "Generate AI Draft"}),
    ).not.toBeNull();
    expect(screen.getAllByLabelText("Seller hints").length).toBeGreaterThan(0);
    expect(screen.queryByText("2 images")).toBeNull();
    expect(
      screen.queryByRole("link", {name: "Open LIST-001 image 1"}),
    ).toBeNull();
    expect(
      screen.queryByRole("link", {name: "Open LIST-001 image 2"}),
    ).toBeNull();
    expect(screen.queryByRole("button", {name: "Generating"})).toBeNull();
    expect(screen.getByLabelText("Title")).not.toBeNull();
    expect(screen.getByLabelText("Description")).not.toBeNull();
    expect(screen.getByLabelText("Price")).not.toBeNull();
    expect(screen.getByLabelText("Item specifics (JSON)")).not.toBeNull();
    expect(screen.queryByText("Final review checklist")).toBeNull();
    expect(
      screen.queryByText(/eBay titles must be 80 characters or fewer\./i),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {name: "Approve For Export"}),
    ).toBeNull();
    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();
  });

  it("renders exactly four supported card condition options", () => {
    render(<ListingEditForm listing={buildListing("needs_review")} />);
    const cardConditionSelect = screen.getByLabelText(
      "Card Condition",
    ) as HTMLSelectElement;

    expect(
      Array.from(cardConditionSelect.options).map(
        (option) => option.textContent,
      ),
    ).toEqual([
      "Select card condition",
      "Near mint or better",
      "Excellent",
      "Very good",
      "Poor",
    ]);
  });

  it("shows saved supported card condition, helper label, condition notes, and item specifics JSON", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/card.jpg"],
          {
            item_specifics: {
              "Card Condition": "EXCELLENT",
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("EXCELLENT");
    expect(
      screen.getByRole("option", {name: "Excellent", selected: true}),
    ).not.toBeNull();
    expect(screen.getByDisplayValue("Visible notes")).not.toBeNull();
    expect(
      (screen.getByLabelText("Item specifics (JSON)") as HTMLTextAreaElement)
        .value,
    ).toContain('"Card Condition": "EXCELLENT"');
  });

  it("normalizes legacy EX - Excellent to EXCELLENT for selection and display", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/legacy-card.jpg"],
          {
            item_specifics: {
              "Card Condition": "EX - Excellent",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("EXCELLENT");
    expect(
      screen.getByRole("option", {name: "Excellent", selected: true}),
    ).not.toBeNull();
    expect(screen.queryByText(/Current saved Card Condition/i)).toBeNull();
    expect(
      (screen.getByLabelText("Item specifics (JSON)") as HTMLTextAreaElement)
        .value,
    ).toContain('"Card Condition": "EXCELLENT"');
  });

  it("normalizes legacy EX to EXCELLENT", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/legacy-ex-card.jpg"],
          {
            item_specifics: {
              "Card Condition": "EX",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("EXCELLENT");
    expect(
      screen.getByRole("option", {name: "Excellent", selected: true}),
    ).not.toBeNull();
  });

  it("normalizes legacy VG to VERY_GOOD", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/legacy-vg-card.jpg"],
          {
            item_specifics: {
              "Card Condition": "VG",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("VERY_GOOD");
    expect(
      screen.getByRole("option", {name: "Very good", selected: true}),
    ).not.toBeNull();
  });

  it("shows an unsupported card condition token warning without crashing", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/unknown-card.jpg"],
          {
            item_specifics: {
              "Card Condition": "MYSTERY",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("");
    expect(
      screen.getByRole("option", {
        name: "Select card condition",
        selected: true,
      }),
    ).not.toBeNull();
    expect(
      screen.getByText(
        /Current saved Card Condition "MYSTERY" is not supported/i,
      ),
    ).not.toBeNull();
  });

  it("does not show a Card Condition section when no saved card condition exists", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/plain-card.jpg"],
          {
            condition_notes: null,
            item_specifics: {
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("");
    expect(
      screen.getByRole("option", {
        name: "Select card condition",
        selected: true,
      }),
    ).not.toBeNull();
    expect(screen.getByLabelText("Condition notes")).not.toBeNull();
  });

  it("saves Card Condition changes through the existing item specifics JSON payload", async () => {
    const user = userEvent.setup();
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/save-card.jpg"],
          {
            item_specifics: {
              "Card Condition": "EX - Excellent",
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("EXCELLENT");

    await user.selectOptions(
      screen.getByLabelText("Card Condition"),
      "VERY_GOOD",
    );
    await user.clear(screen.getByLabelText("Condition notes"));
    await user.type(screen.getByLabelText("Condition notes"), "Updated notes");
    await user.click(screen.getByRole("button", {name: "Save edits"}));

    expect(saveListingEditsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(FormData),
    );

    const submittedFormData = saveListingEditsMock.mock.calls[0][1] as FormData;
    const submittedItemSpecifics = JSON.parse(
      String(submittedFormData.get("item_specifics")),
    ) as Record<string, unknown>;

    expect(submittedItemSpecifics["Card Condition"]).toBe("VERY_GOOD");
    expect(submittedItemSpecifics["Player"]).toBe("Mike Trout");
    expect(JSON.stringify(submittedItemSpecifics)).not.toContain(
      "EX - Excellent",
    );
    expect(submittedFormData.get("condition_notes")).toBe("Updated notes");
  });

  it("preserves manual item specifics edits while normalizing legacy Card Condition", async () => {
    const user = userEvent.setup();
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/manual-json-card.jpg"],
          {
            item_specifics: {
              "Card Condition": "VG",
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
          },
        )}
      />,
    );

    fireEvent.change(screen.getByLabelText("Item specifics (JSON)"), {
      target: {
        value: JSON.stringify(
          {
            "Card Condition": "EX - Excellent",
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome Update",
            Year: "2024",
          },
          null,
          2,
        ),
      },
    });
    await user.click(screen.getByRole("button", {name: "Save edits"}));

    const submittedFormData = saveListingEditsMock.mock.calls[0][1] as FormData;
    const submittedItemSpecifics = JSON.parse(
      String(submittedFormData.get("item_specifics")),
    ) as Record<string, unknown>;

    expect(submittedItemSpecifics["Card Condition"]).toBe("EX - Excellent");
    expect(submittedItemSpecifics["Set"]).toBe("Topps Chrome Update");
    expect(submittedItemSpecifics["Year"]).toBe("2024");
    expect(submittedItemSpecifics["Player"]).toBe("Mike Trout");
  });

  it("saves edited item specifics JSON when clicking Save edits", async () => {
    const user = userEvent.setup();
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/manual-json-card.jpg"],
          {
            item_specifics: {
              "Card Condition": "EXCELLENT",
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
          },
        )}
      />,
    );

    fireEvent.change(screen.getByLabelText("Item specifics (JSON)"), {
      target: {
        value: JSON.stringify(
          {
            "Card Condition": "VERY_GOOD",
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome Update",
            Year: "2024",
          },
          null,
          2,
        ),
      },
    });

    await user.click(screen.getByRole("button", {name: "Save edits"}));

    const submittedFormData = saveListingEditsMock.mock.calls[0][1] as FormData;
    const submittedItemSpecifics = JSON.parse(
      String(submittedFormData.get("item_specifics")),
    ) as Record<string, unknown>;

    expect(submittedItemSpecifics["Card Condition"]).toBe("VERY_GOOD");
    expect(submittedItemSpecifics["Set"]).toBe("Topps Chrome Update");
    expect(submittedItemSpecifics["Year"]).toBe("2024");
    expect(submittedItemSpecifics["Player"]).toBe("Mike Trout");
  });

  it("blocks save when item specifics JSON is invalid and does not submit textarea text", async () => {
    const user = userEvent.setup();
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});

    render(
      <ListingEditForm
        listing={buildListing("needs_review", [
          "https://example.com/invalid-json.jpg",
        ])}
      />,
    );

    fireEvent.change(screen.getByLabelText("Item specifics (JSON)"), {
      target: {
        value: '{"Card Condition": "EX - Excellent"',
      },
    });
    await user.click(screen.getByRole("button", {name: "Save edits"}));

    expect(
      screen.getByText("Item specifics must be valid JSON."),
    ).not.toBeNull();
    expect(saveListingEditsMock).not.toHaveBeenCalled();
  });

  it("saves normalized backend token when legacy card condition remains selected", async () => {
    const user = userEvent.setup();
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/save-legacy-card.jpg"],
          {
            item_specifics: {
              "Card Condition": "EX - Excellent",
              "Card Number": "1",
              Player: "Mike Trout",
            },
          },
        )}
      />,
    );

    await user.click(screen.getByRole("button", {name: "Save edits"}));

    const submittedFormData = saveListingEditsMock.mock.calls[0][1] as FormData;
    const submittedItemSpecifics = JSON.parse(
      String(submittedFormData.get("item_specifics")),
    ) as Record<string, unknown>;

    expect(submittedItemSpecifics["Card Condition"]).toBe("EXCELLENT");
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
    expect(screen.getByText("Pricing research")).not.toBeNull();

    expect(screen.getByLabelText("Title")).toHaveProperty("disabled", false);
    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("");
    expect(screen.getByLabelText("Item specifics (JSON)")).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("button", {name: "Save edits"})).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.queryByRole("button", {name: "Generate"})).toBeNull();
    expect(screen.queryByRole("button", {name: "Assets ready"})).toBeNull();
    expect(screen.queryByText("2 images")).toBeNull();
    expect(
      screen.queryByRole("link", {name: "Open LIST-001 image 1"}),
    ).toBeNull();
    expect(
      screen.queryByRole("link", {name: "Open LIST-001 image 2"}),
    ).toBeNull();
    expect(screen.getByText("Final review checklist")).not.toBeNull();
    expect(
      screen.queryByText(/eBay titles must be 80 characters or fewer\./i),
    ).toBeNull();
    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });
    expect(approveButton).toHaveProperty("disabled", true);

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
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

  it("shows Inventory / SKU review section with Gemini BSKBL suggestion", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            listing_id: "Single-000001",
            item_specifics: {
              Player: "Mike Trout",
              skuCategoryCode: "BSKBL",
            },
          },
        )}
      />,
    );

    expect(screen.getByText("Inventory / SKU")).not.toBeNull();
    expect(
      screen.getByText("Backend finalizes this SKU on approval."),
    ).not.toBeNull();
    expect(
      (screen.getByLabelText("SKU category prefix") as HTMLSelectElement).value,
    ).toBe("BSKBL");
    expect(screen.getByText("BSKBL-Single-000001")).not.toBeNull();
  });

  it("shows BSBL lot preview for valid lot listing IDs", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            listing_id: "Lot-000002",
            item_specifics: {
              Player: "Mike Trout",
              skuCategoryCode: "BSBL",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("SKU category prefix") as HTMLSelectElement).value,
    ).toBe("BSBL");
    expect(screen.getByText("BSBL-Lot-000002")).not.toBeNull();
  });

  it("defaults missing skuCategoryCode to OTHER preview", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            listing_id: "Single-000003",
            item_specifics: {
              Player: "Mike Trout",
            },
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("SKU category prefix") as HTMLSelectElement).value,
    ).toBe("OTHER");
    expect(screen.getByText("OTHER-Single-000003")).not.toBeNull();
  });

  it("defaults invalid skuCategoryCode to OTHER and hides invalid option", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            listing_id: "Single-000004",
            item_specifics: {
              Player: "Mike Trout",
              skuCategoryCode: "FOOTBALL",
            },
          },
        )}
      />,
    );

    const prefixSelect = screen.getByLabelText(
      "SKU category prefix",
    ) as HTMLSelectElement;

    expect(prefixSelect.value).toBe("OTHER");
    expect(screen.queryByRole("option", {name: /FOOTBALL/i})).toBeNull();
    expect(screen.getByText("OTHER-Single-000004")).not.toBeNull();
  });

  it("updates only skuCategoryCode within item specifics and never sends full sku in save payload", async () => {
    const user = userEvent.setup();
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            listing_id: "Single-000005",
            sku: "Single-000005",
            item_specifics: {
              Player: "Mike Trout",
              Set: "Topps Chrome",
              skuCategoryCode: "OTHER",
            },
          },
        )}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("SKU category prefix"),
      "BSKBL",
    );
    await user.click(screen.getByRole("button", {name: "Save edits"}));

    const submittedFormData = saveListingEditsMock.mock.calls[0][1] as FormData;
    const submittedItemSpecifics = JSON.parse(
      String(submittedFormData.get("item_specifics")),
    ) as Record<string, unknown>;

    expect(submittedItemSpecifics).toMatchObject({
      Player: "Mike Trout",
      Set: "Topps Chrome",
      skuCategoryCode: "BSKBL",
    });
    expect(submittedFormData.get("sku")).toBeNull();
    expect(JSON.stringify(submittedItemSpecifics)).not.toContain(
      "BSKBL-Single-000005",
    );
  });

  it("approve action does not send full sku text", async () => {
    const user = userEvent.setup();
    approveListingForExportMock.mockResolvedValueOnce({
      error: null,
      success: "Approved Single-000006 for export.",
    });

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            listing_id: "Single-000006",
            sku: "Single-000006",
            item_specifics: {
              Player: "Mike Trout",
              skuCategoryCode: "BSKBL",
            },
          },
        )}
      />,
    );

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    await user.click(screen.getByRole("button", {name: "Approve For Export"}));

    const submittedFormData = approveListingForExportMock.mock
      .calls[0][1] as FormData;
    expect(submittedFormData.get("listing_id")).toBe("Single-000006");
    expect(submittedFormData.get("current_status")).toBe("needs_review");
    expect(submittedFormData.get("sku")).toBeNull();
    expect(submittedFormData.get("item_specifics")).toBeNull();
    expect(Array.from(submittedFormData.keys())).toEqual([
      "listing_id",
      "current_status",
    ]);
  });

  it("does not show editable SKU prefix selector outside needs_review", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "approved_for_export",
          ["https://example.com/review.jpg"],
          {
            listing_id: "Single-000007",
            item_specifics: {
              Player: "Mike Trout",
              skuCategoryCode: "BSKBL",
            },
          },
        )}
      />,
    );

    expect(screen.queryByText("Inventory / SKU")).toBeNull();
    expect(screen.queryByLabelText("SKU category prefix")).toBeNull();
  });

  it("shows safe warning and no invented preview for malformed listing IDs", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            listing_id: "LIST-001",
            item_specifics: {
              Player: "Mike Trout",
              skuCategoryCode: "BSKBL",
            },
          },
        )}
      />,
    );

    expect(
      screen.getByText(/Listing ID is not in base Single\/Lot format\./i),
    ).not.toBeNull();
    expect(screen.queryByText("BSKBL-LIST-001")).toBeNull();
  });

  it("blocks approve for raw trading-card listings without a supported Card Condition", async () => {
    const user = userEvent.setup();

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/raw-card.jpg"],
          {
            category_id: "183050",
            condition_id: "4000",
            item_specifics: {
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
            title: "Raw trading card title",
          },
        )}
      />,
    );

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", true);
    expect(
      screen.getByText(
        /Trading-card listings require a supported Card Condition before export\./i,
      ),
    ).not.toBeNull();
  });

  it("allows approve for raw trading-card listings with a supported Card Condition", async () => {
    const user = userEvent.setup();

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/raw-valid-card.jpg"],
          {
            category_id: "183050",
            condition_id: "4000",
            item_specifics: {
              "Card Condition": "EXCELLENT",
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
            title: "Valid trading card title",
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("EXCELLENT");

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", false);
  });

  it("allows approve for raw trading-card listings with a normalized legacy Card Condition", async () => {
    const user = userEvent.setup();

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/raw-legacy-valid-card.jpg"],
          {
            category_id: "183050",
            condition_id: "4000",
            item_specifics: {
              "Card Condition": "VG",
              "Card Number": "1",
              Player: "Mike Trout",
            },
            title: "Valid legacy trading card title",
          },
        )}
      />,
    );

    expect(
      (screen.getByLabelText("Card Condition") as HTMLSelectElement).value,
    ).toBe("VERY_GOOD");

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", false);
  });

  it("blocks approve for graded trading-card listings", async () => {
    const user = userEvent.setup();

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/graded-card.jpg"],
          {
            category_id: "183454",
            condition_id: "2750",
            item_specifics: {
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
            title: "Graded trading card title",
          },
        )}
      />,
    );

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", true);
    expect(
      screen.getByText(
        /Graded trading-card descriptors are not supported yet\. Use raw\/ungraded condition for this workflow\./i,
      ),
    ).not.toBeNull();
  });

  it("does not require Card Condition for non-trading-card listings", async () => {
    const user = userEvent.setup();

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/non-card.jpg"],
          {
            category_id: "CAT-1",
            condition_id: "COND-1",
            item_specifics: {
              "Card Number": "1",
              Player: "Mike Trout",
              Set: "Topps Chrome",
              Year: "2023",
            },
            title: "Non-trading-card title",
          },
        )}
      />,
    );

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", false);
  });

  it("shows title-length validation and keeps approve disabled when the title is 81 characters", async () => {
    const user = userEvent.setup();
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/too-long.jpg"],
          {
            title: "A".repeat(81),
          },
        )}
      />,
    );

    expect(
      screen.getByText(
        /eBay titles must be 80 characters or fewer\. Current title: 81 characters\./i,
      ),
    ).not.toBeNull();

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });
    expect(approveButton).toHaveProperty("disabled", true);

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", true);
  });

  it("allows approve once the checklist is complete when the title is exactly 80 characters", async () => {
    const user = userEvent.setup();
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/exact-length.jpg"],
          {
            title: "A".repeat(80),
          },
        )}
      />,
    );

    expect(
      screen.queryByText(/eBay titles must be 80 characters or fewer\./i),
    ).toBeNull();

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });
    expect(approveButton).toHaveProperty("disabled", true);

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", false);
  });

  it("resets the checklist when switching listings", async () => {
    const user = userEvent.setup();
    const {rerender} = render(
      <ListingEditForm listing={buildListing("needs_review")} />,
    );

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });
    await user.click(
      screen.getByLabelText(FIRST_LIVE_REVIEW_CHECKLIST_LABELS[0]),
    );
    expect(approveButton).toHaveProperty("disabled", true);

    rerender(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/other.jpg"],
          {
            listing_id: "LIST-002",
            title: "Another listing",
          },
        )}
      />,
    );

    expect(
      screen.getByRole("button", {name: "Approve For Export"}),
    ).toHaveProperty("disabled", true);
    expect(
      (
        screen.getByLabelText(
          FIRST_LIVE_REVIEW_CHECKLIST_LABELS[0],
        ) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it("shows retry publish for approved_for_export listings with user-fixable errors and submits listing_id", async () => {
    const user = userEvent.setup();
    retryPublishListingMock.mockResolvedValueOnce({
      error: null,
      success: "Retry publish queued for LIST-001.",
    });

    render(
      <ListingEditForm
        listing={buildListing(
          "approved_for_export",
          ["https://example.com/retry-image.jpg"],
          {
            last_error_code: "publish_offer_failed",
            last_error_context: {category: "user_fixable"},
            sub_status: "idle",
          },
        )}
      />,
    );

    expect(screen.queryByText("Final review checklist")).toBeNull();
    expect(
      screen.queryByRole("button", {name: "Approve For Export"}),
    ).toBeNull();
    expect(screen.getByRole("button", {name: "Retry Publish"})).not.toBeNull();
    expect(
      screen.getByText(/Fix the fields above, then retry publish\./i),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", {name: "Retry Publish"}));

    expect(retryPublishListingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(FormData),
    );

    const submittedFormData = retryPublishListingMock.mock
      .calls[0][1] as FormData;
    expect(submittedFormData.get("listing_id")).toBe("LIST-001");
  });

  it("hides retry publish while publishing_to_ebay and for approved_for_export listings without a retryable error", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "approved_for_export",
          ["https://example.com/publish-image.jpg"],
          {
            last_error_code: "publish_offer_failed",
            last_error_context: {category: "user_fixable"},
            sub_status: "publishing_to_ebay",
          },
        )}
      />,
    );

    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();

    cleanup();

    render(
      <ListingEditForm
        listing={buildListing(
          "approved_for_export",
          ["https://example.com/no-error-image.jpg"],
          {
            last_error_code: null,
            last_error_context: null,
            sub_status: "idle",
          },
        )}
      />,
    );

    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();
  });

  it("renders succeeded pricing research summary with all fields and external links", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            latest_pricing_research: {
              comp_summary: {
                rejected_comp_count: 3,
                rejected_comp_ids: ["comp-4", "comp-5", "comp-6"],
                selected_comp_count: 4,
                selected_comp_ids: ["comp-1", "comp-2", "comp-3", "comp-7"],
                total_comp_count: 7,
              },
              confidence: "high",
              created_at: "2026-06-19T00:00:00.000Z",
              error_code: null,
              error_message: null,
              listing_id: "LIST-001",
              llm_price_explanation: "Strong comps support this price.",
              median_sold_price: 45.0,
              pricing_model_name: "gemini-2.5-flash",
              provider: "soldcomps",
              query: "2023 Topps Chrome Mike Trout",
              research_id: "research-1",
              sold_count: 12,
              status: "succeeded",
              suggested_price: 42.0,
              updated_at: "2026-06-19T00:00:00.000Z",
            },
          },
        )}
      />,
    );

    expect(screen.getByText("Pricing research")).not.toBeNull();
    expect(screen.getByText("$42.00")).not.toBeNull();
    expect(screen.getByText("high confidence")).not.toBeNull();
    expect(screen.getByText("$45.00")).not.toBeNull();
    expect(screen.getByText("12")).not.toBeNull();
    expect(screen.getByText("Strong comps support this price.")).not.toBeNull();
    // counts rendered inside nested spans; verify via section textContent
    const pricingSection = screen
      .getByText("Strong comps support this price.")
      .closest("div")!;
    expect(pricingSection.textContent).toContain("Selected: 4");
    expect(pricingSection.textContent).toContain("Rejected: 3");
    expect(pricingSection.textContent).toContain("Total comps: 7");
    expect(
      screen.getByText("Provider: soldcomps", {exact: false}),
    ).not.toBeNull();
    expect(
      screen.getByText("Model: gemini-2.5-flash", {exact: false}),
    ).not.toBeNull();
    expect(
      screen.getByText("Query: 2023 Topps Chrome Mike Trout"),
    ).not.toBeNull();
    expect(screen.getByRole("link", {name: "130point"})).not.toBeNull();
    expect(screen.getByRole("link", {name: "SportsCardsPro"})).not.toBeNull();
    expect(
      screen.getByRole("button", {name: "Approve For Export"}),
    ).not.toBeNull();
  });

  it("renders provider-zero failed pricing research without blocking approval", async () => {
    const user = userEvent.setup();

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            latest_pricing_research: {
              comp_summary: {
                rejected_comp_count: 0,
                rejected_comp_ids: [],
                selected_comp_count: 0,
                selected_comp_ids: [],
                total_comp_count: 0,
              },
              confidence: null,
              created_at: "2026-06-19T00:00:00.000Z",
              error_code: "provider_rate_limited",
              error_message: "SoldComps API rate limit exceeded.",
              failure_summary: {
                provider_returned_count: 0,
                query: "2023 Topps Chrome Mike Trout",
                reason: "provider_zero_results",
                requested_count: 25,
              },
              listing_id: "LIST-001",
              llm_price_explanation: null,
              median_sold_price: null,
              pricing_model_name: null,
              provider: "soldcomps",
              query: "2023 Topps Chrome Mike Trout",
              research_id: "research-2",
              sold_count: null,
              status: "failed",
              suggested_price: null,
              updated_at: "2026-06-19T00:00:00.000Z",
            },
          },
        )}
      />,
    );

    expect(screen.getByText("Pricing research")).not.toBeNull();
    expect(
      screen.getByText(
        /provider returned no matching sold comps/i,
      ),
    ).not.toBeNull();
    expect(screen.getByText("failed")).not.toBeNull();
    expect(screen.getByText("Requested comps: 25")).not.toBeNull();
    expect(screen.getByText("Provider returned: 0")).not.toBeNull();
    expect(
      screen.getByText("provider_rate_limited", {exact: false}),
    ).not.toBeNull();
    expect(
      screen.getByText("SoldComps API rate limit exceeded."),
    ).not.toBeNull();
    expect(screen.getByText("Provider: soldcomps")).not.toBeNull();
    expect(
      screen.getByText("Query: 2023 Topps Chrome Mike Trout"),
    ).not.toBeNull();
    expect(screen.getByRole("link", {name: "130point"})).not.toBeNull();
    expect(screen.getByRole("link", {name: "SportsCardsPro"})).not.toBeNull();

    // Price input remains editable when pricing research failed
    // and suggested_price is null.
    const priceInput = screen.getByLabelText("Price") as HTMLInputElement;
    expect(priceInput).toHaveProperty("disabled", false);

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });
    expect(approveButton).toHaveProperty("disabled", true);

    for (const checklistLabel of FIRST_LIVE_REVIEW_CHECKLIST_LABELS) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", false);
  });

  it("renders all-comps-rejected pricing failure details", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            latest_pricing_research: {
              comp_summary: {
                rejected_comp_count: 5,
                rejected_comp_ids: ["comp-1", "comp-2", "comp-3", "comp-4", "comp-5"],
                selected_comp_count: 0,
                selected_comp_ids: [],
                total_comp_count: 5,
              },
              confidence: null,
              created_at: "2026-06-19T00:00:00.000Z",
              error_code: "research_price_suggested_price_invalid",
              error_message: "Suggested price did not pass validation.",
              failure_summary: {
                accepted_comp_count: 0,
                provider_returned_count: 5,
                query: "2023 Topps Chrome Mike Trout",
                reason: "all_comps_rejected",
                rejected_comp_count: 5,
                rejected_reason_counts: {
                  price_outlier: 3,
                  title_mismatch: 2,
                },
              },
              listing_id: "LIST-001",
              llm_price_explanation: null,
              median_sold_price: null,
              pricing_model_name: null,
              provider: "soldcomps",
              query: "2023 Topps Chrome Mike Trout",
              research_id: "research-2b",
              sold_count: null,
              status: "failed",
              suggested_price: null,
              updated_at: "2026-06-19T00:00:00.000Z",
            },
          },
        )}
      />,
    );

    expect(
      screen.getByText(/backend validation rejected them all/i),
    ).not.toBeNull();
    expect(screen.getByText("Provider returned: 5")).not.toBeNull();
    expect(screen.getByText("Accepted comps: 0")).not.toBeNull();
    expect(screen.getByText("Rejected comps: 5")).not.toBeNull();
    expect(
      screen.getByText("Query: 2023 Topps Chrome Mike Trout"),
    ).not.toBeNull();
    expect(
      screen.getByText(
        "Rejected reasons: price outlier (3), title mismatch (2)",
      ),
    ).not.toBeNull();
  });

  it("renders provider-failure pricing failure details", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            latest_pricing_research: {
              comp_summary: {
                rejected_comp_count: 0,
                rejected_comp_ids: [],
                selected_comp_count: 0,
                selected_comp_ids: [],
                total_comp_count: 0,
              },
              confidence: null,
              created_at: "2026-06-19T00:00:00.000Z",
              error_code: "provider_timeout",
              error_message: "Apify request timed out.",
              failure_summary: {
                provider_failure_category: "retryable_timeout",
                provider_failure_code: "apify_timeout",
                provider_failure_status: "504",
                query: "2023 Topps Chrome Mike Trout",
                reason: "provider_failure",
              },
              listing_id: "LIST-001",
              llm_price_explanation: null,
              median_sold_price: null,
              pricing_model_name: null,
              provider: "apify",
              query: "2023 Topps Chrome Mike Trout",
              research_id: "research-2c",
              sold_count: null,
              status: "failed",
              suggested_price: null,
              updated_at: "2026-06-19T00:00:00.000Z",
            },
          },
        )}
      />,
    );

    expect(
      screen.getByText(/provider call did not complete/i),
    ).not.toBeNull();
    expect(screen.getByText("Failure code: apify_timeout")).not.toBeNull();
    expect(
      screen.getByText("Failure category: retryable timeout"),
    ).not.toBeNull();
    expect(
      screen.getByText("Query: 2023 Topps Chrome Mike Trout"),
    ).not.toBeNull();
    expect(screen.getByText("Failure status: 504")).not.toBeNull();
    expect(screen.getByText("Apify request timed out.")).not.toBeNull();
  });

  it("falls back to the generic failed pricing summary for unknown or missing failure_summary", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            latest_pricing_research: {
              comp_summary: {
                rejected_comp_count: 0,
                rejected_comp_ids: [],
                selected_comp_count: 0,
                selected_comp_ids: [],
                total_comp_count: 0,
              },
              confidence: null,
              created_at: "2026-06-19T00:00:00.000Z",
              error_code: "provider_error",
              error_message: "Provider returned an unexpected response.",
              failure_summary: {
                reason: "unknown",
              },
              listing_id: "LIST-001",
              llm_price_explanation: null,
              median_sold_price: null,
              pricing_model_name: null,
              provider: "soldcomps",
              query: "2023 Topps Chrome Mike Trout",
              research_id: "research-2d",
              sold_count: null,
              status: "failed",
              suggested_price: null,
              updated_at: "2026-06-19T00:00:00.000Z",
            },
          },
        )}
      />,
    );

    expect(
      screen.getByText(
        /Pricing research failed\. Enter or confirm the price manually/i,
      ),
    ).not.toBeNull();
    expect(
      screen.getByText("Provider returned an unexpected response."),
    ).not.toBeNull();
    expect(
      screen.getByText("Query: 2023 Topps Chrome Mike Trout"),
    ).not.toBeNull();

    cleanup();

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            latest_pricing_research: {
              comp_summary: {
                rejected_comp_count: 0,
                rejected_comp_ids: [],
                selected_comp_count: 0,
                selected_comp_ids: [],
                total_comp_count: 0,
              },
              confidence: null,
              created_at: "2026-06-19T00:00:00.000Z",
              error_code: "provider_error",
              error_message: "Provider returned an unexpected response.",
              listing_id: "LIST-001",
              llm_price_explanation: null,
              median_sold_price: null,
              pricing_model_name: null,
              provider: "soldcomps",
              query: "2023 Topps Chrome Mike Trout",
              research_id: "research-2e",
              sold_count: null,
              status: "failed",
              suggested_price: null,
              updated_at: "2026-06-19T00:00:00.000Z",
            },
          },
        )}
      />,
    );

    expect(
      screen.getByText(
        /Pricing research failed\. Enter or confirm the price manually/i,
      ),
    ).not.toBeNull();
    expect(
      screen.getByText("Provider returned an unexpected response."),
    ).not.toBeNull();
    expect(
      screen.getByText("Query: 2023 Topps Chrome Mike Trout"),
    ).not.toBeNull();
  });

  it("allows saving price edits when pricing research failed and suggested_price is null", async () => {
    const user = userEvent.setup();
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            price: null,
            latest_pricing_research: {
              comp_summary: {
                rejected_comp_count: 0,
                rejected_comp_ids: [],
                selected_comp_count: 0,
                selected_comp_ids: [],
                total_comp_count: 0,
              },
              confidence: null,
              created_at: "2026-06-19T00:00:00.000Z",
              error_code: "provider_timeout",
              error_message: "Apify request timed out.",
              listing_id: "LIST-001",
              llm_price_explanation: null,
              median_sold_price: null,
              pricing_model_name: null,
              provider: "apify",
              query: "2023 Topps Chrome Mike Trout",
              research_id: "research-3",
              sold_count: null,
              status: "failed",
              suggested_price: null,
              updated_at: "2026-06-19T00:00:00.000Z",
            },
          },
        )}
      />,
    );

    const priceInput = screen.getByLabelText("Price") as HTMLInputElement;
    expect(priceInput).toHaveProperty("disabled", false);
    expect(priceInput.value).toBe("");

    await user.clear(priceInput);
    await user.type(priceInput, "29.99");
    await user.click(screen.getByRole("button", {name: "Save edits"}));

    expect(saveListingEditsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(FormData),
    );

    const submittedFormData = saveListingEditsMock.mock.calls[0][1] as FormData;
    expect(submittedFormData.get("price")).toBe("29.99");
  });

  it("does not auto-trigger pricing re-run when saving edits", async () => {
    const user = userEvent.setup();
    saveListingEditsMock.mockResolvedValueOnce({error: null, success: true});

    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            latest_pricing_research: {
              comp_summary: {
                rejected_comp_count: 0,
                rejected_comp_ids: [],
                selected_comp_count: 0,
                selected_comp_ids: [],
                total_comp_count: 0,
              },
              confidence: null,
              created_at: "2026-06-19T00:00:00.000Z",
              error_code: "research_price_suggested_price_invalid",
              error_message: "Suggested price did not pass validation.",
              listing_id: "LIST-001",
              llm_price_explanation: null,
              median_sold_price: null,
              pricing_model_name: null,
              provider: "soldcomps",
              query: "2023 Topps Chrome Mike Trout",
              research_id: "research-4",
              sold_count: null,
              status: "failed",
              suggested_price: null,
              updated_at: "2026-06-19T00:00:00.000Z",
            },
            listing_type: "single",
            sub_status: "review_pending",
          },
        )}
      />,
    );

    await user.clear(screen.getByLabelText("Price"));
    await user.type(screen.getByLabelText("Price"), "31.99");
    await user.click(screen.getByRole("button", {name: "Save edits"}));

    expect(saveListingEditsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(FormData),
    );
    expect(retryListingPricingMock).not.toHaveBeenCalled();
  });

  it("shows neutral message when latest_pricing_research is null or absent", () => {
    render(
      <ListingEditForm
        listing={buildListing(
          "needs_review",
          ["https://example.com/review.jpg"],
          {
            latest_pricing_research: null,
          },
        )}
      />,
    );

    expect(screen.getByText("Pricing research")).not.toBeNull();
    expect(screen.getByText("No saved pricing research yet.")).not.toBeNull();
    expect(screen.getByRole("link", {name: "130point"})).not.toBeNull();
    expect(screen.getByRole("link", {name: "SportsCardsPro"})).not.toBeNull();

    cleanup();

    render(
      <ListingEditForm
        listing={buildListing("needs_review", [
          "https://example.com/review.jpg",
        ])}
      />,
    );

    expect(screen.getByText("Pricing research")).not.toBeNull();
    expect(screen.getByText("No saved pricing research yet.")).not.toBeNull();
    expect(screen.getByRole("link", {name: "130point"})).not.toBeNull();
    expect(screen.getByRole("link", {name: "SportsCardsPro"})).not.toBeNull();
  });
});
