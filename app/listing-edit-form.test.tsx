import {cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

const {
  approveListingForExportMock,
  enqueueGenerateListingMock,
  retryPublishListingMock,
  saveListingEditsMock,
  saveListingImageUrlsMock,
  updateListingStatusMock,
} = vi.hoisted(() => ({
  approveListingForExportMock: vi.fn(),
  enqueueGenerateListingMock: vi.fn(),
  retryPublishListingMock: vi.fn(),
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

vi.mock("@/app/listing-retry-publish-actions", () => ({
  retryPublishListingAction: retryPublishListingMock,
}));

import {ListingEditForm} from "@/app/listing-edit-form";

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
    retryPublishListingMock.mockReset();
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
      "Card Condition",
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
          ...buildListing("assets_ready", [
            "https://example.com/image-1.jpg",
            "https://example.com/image-2.jpg",
          ], {
            title: "A".repeat(81),
          }),
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
      screen.queryByText(/eBay titles must be 80 characters or fewer\./i),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {name: "Approve For Export"}),
    ).toBeNull();
    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();
  });

  it("shows saved card condition, helper label, condition notes, and raw item specifics JSON", () => {
    render(
      <ListingEditForm
        listing={buildListing("needs_review", ["https://example.com/card.jpg"], {
          item_specifics: {
            "Card Condition": "VG",
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome",
            Year: "2023",
          },
        })}
      />,
    );

    expect((screen.getByLabelText("Card Condition") as HTMLSelectElement).value)
      .toBe("VG");
    expect(
      screen.getByRole("option", {name: "VG — Very Good", selected: true}),
    ).not.toBeNull();
    expect(screen.getByDisplayValue("Visible notes")).not.toBeNull();
    expect(
      (screen.getByLabelText("Item specifics (JSON)") as HTMLTextAreaElement)
        .value,
    ).toContain('"Card Condition": "VG"');
  });

  it("shows an unknown card condition token without crashing", () => {
    render(
      <ListingEditForm
        listing={buildListing("needs_review", ["https://example.com/unknown-card.jpg"], {
          item_specifics: {
            "Card Condition": "MYSTERY",
          },
        })}
      />,
    );

    expect((screen.getByLabelText("Card Condition") as HTMLSelectElement).value)
      .toBe("");
    expect(
      screen.getByRole("option", {
        name: "Select card condition",
        selected: true,
      }),
    ).not.toBeNull();
    expect(
      screen.getByText(/Current saved Card Condition MYSTERY is not supported/i),
    ).not.toBeNull();
  });

  it("does not show a Card Condition section when no saved card condition exists", () => {
    render(
      <ListingEditForm
        listing={buildListing("needs_review", ["https://example.com/plain-card.jpg"], {
          condition_notes: null,
          item_specifics: {
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome",
            Year: "2023",
          },
        })}
      />,
    );

    expect((screen.getByLabelText("Card Condition") as HTMLSelectElement).value)
      .toBe("");
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
        listing={buildListing("needs_review", ["https://example.com/save-card.jpg"], {
          item_specifics: {
            "Card Condition": "VG",
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome",
            Year: "2023",
          },
        })}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Card Condition"), "EX");
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

    expect(submittedItemSpecifics["Card Condition"]).toBe("EX");
    expect(submittedItemSpecifics["Player"]).toBe("Mike Trout");
    expect(JSON.stringify(submittedItemSpecifics)).not.toContain("Very Good");
    expect(submittedFormData.get("condition_notes")).toBe("Updated notes");
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
      screen.getByText("Pricing research"),
    ).not.toBeNull();

    expect(screen.getByLabelText("Title")).toHaveProperty("disabled", false);
    expect((screen.getByLabelText("Card Condition") as HTMLSelectElement).value)
      .toBe("");
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
    expect(screen.getByText("2 images")).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Open LIST-001 image 1"}),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Open LIST-001 image 2"}),
    ).not.toBeNull();
    expect(screen.getByText("Final review checklist")).not.toBeNull();
    expect(
      screen.queryByText(/eBay titles must be 80 characters or fewer\./i),
    ).toBeNull();
    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();

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

  it("blocks approve for raw trading-card listings without a supported Card Condition", async () => {
    const user = userEvent.setup();

    render(
      <ListingEditForm
        listing={buildListing("needs_review", ["https://example.com/raw-card.jpg"], {
          category_id: "183050",
          condition_id: "4000",
          item_specifics: {
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome",
            Year: "2023",
          },
          title: "Raw trading card title",
        })}
      />,
    );

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

    for (const checklistLabel of [
      "Title has been reviewed.",
      "Price has been reviewed.",
      "Category/aspects have been reviewed.",
      "Photos have been reviewed.",
      "Shipping/condition details have been reviewed.",
    ]) {
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
        listing={buildListing("needs_review", ["https://example.com/raw-valid-card.jpg"], {
          category_id: "183050",
          condition_id: "4000",
          item_specifics: {
            "Card Condition": "VG",
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome",
            Year: "2023",
          },
          title: "Valid trading card title",
        })}
      />,
    );

    expect((screen.getByLabelText("Card Condition") as HTMLSelectElement).value)
      .toBe("VG");

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

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
  });

  it("blocks approve for graded trading-card listings", async () => {
    const user = userEvent.setup();

    render(
      <ListingEditForm
        listing={buildListing("needs_review", ["https://example.com/graded-card.jpg"], {
          category_id: "183454",
          condition_id: "2750",
          item_specifics: {
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome",
            Year: "2023",
          },
          title: "Graded trading card title",
        })}
      />,
    );

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

    for (const checklistLabel of [
      "Title has been reviewed.",
      "Price has been reviewed.",
      "Category/aspects have been reviewed.",
      "Photos have been reviewed.",
      "Shipping/condition details have been reviewed.",
    ]) {
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
        listing={buildListing("needs_review", ["https://example.com/non-card.jpg"], {
          category_id: "CAT-1",
          condition_id: "COND-1",
          item_specifics: {
            "Card Number": "1",
            Player: "Mike Trout",
            Set: "Topps Chrome",
            Year: "2023",
          },
          title: "Non-trading-card title",
        })}
      />,
    );

    const approveButton = screen.getByRole("button", {
      name: "Approve For Export",
    });

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
  });

  it("shows title-length validation and keeps approve disabled when the title is 81 characters", async () => {
    const user = userEvent.setup();
    render(
      <ListingEditForm
        listing={buildListing("needs_review", ["https://example.com/too-long.jpg"], {
          title: "A".repeat(81),
        })}
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

    for (const checklistLabel of [
      "Title has been reviewed.",
      "Price has been reviewed.",
      "Category/aspects have been reviewed.",
      "Photos have been reviewed.",
      "Shipping/condition details have been reviewed.",
    ]) {
      await user.click(screen.getByLabelText(checklistLabel));
    }

    expect(approveButton).toHaveProperty("disabled", true);
  });

  it("allows approve once the checklist is complete when the title is exactly 80 characters", async () => {
    const user = userEvent.setup();
    render(
      <ListingEditForm
        listing={buildListing("needs_review", ["https://example.com/exact-length.jpg"], {
          title: "A".repeat(80),
        })}
      />,
    );

    expect(
      screen.queryByText(/eBay titles must be 80 characters or fewer\./i),
    ).toBeNull();

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
  });

  it("shows retry publish for approved_for_export listings with user-fixable errors and submits listing_id", async () => {
    const user = userEvent.setup();
    retryPublishListingMock.mockResolvedValueOnce({error: null, success: "Retry publish queued for LIST-001."});

    render(
      <ListingEditForm
        listing={buildListing("approved_for_export", ["https://example.com/retry-image.jpg"], {
          last_error_code: "publish_offer_failed",
          last_error_context: {category: "user_fixable"},
          sub_status: "idle",
        })}
      />,
    );

    expect(screen.queryByText("Final review checklist")).toBeNull();
    expect(screen.queryByRole("button", {name: "Approve For Export"})).toBeNull();
    expect(screen.getByRole("button", {name: "Retry Publish"})).not.toBeNull();
    expect(screen.getByText(/Fix the fields above, then retry publish\./i)).not.toBeNull();

    await user.click(screen.getByRole("button", {name: "Retry Publish"}));

    expect(retryPublishListingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(FormData),
    );

    const submittedFormData = retryPublishListingMock.mock.calls[0][1] as FormData;
    expect(submittedFormData.get("listing_id")).toBe("LIST-001");
  });

  it("hides retry publish while publishing_to_ebay and for approved_for_export listings without a retryable error", () => {
    render(
      <ListingEditForm
        listing={buildListing("approved_for_export", ["https://example.com/publish-image.jpg"], {
          last_error_code: "publish_offer_failed",
          last_error_context: {category: "user_fixable"},
          sub_status: "publishing_to_ebay",
        })}
      />,
    );

    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();

    cleanup();

    render(
      <ListingEditForm
        listing={buildListing("approved_for_export", ["https://example.com/no-error-image.jpg"], {
          last_error_code: null,
          last_error_context: null,
          sub_status: "idle",
        })}
      />,
    );

    expect(screen.queryByRole("button", {name: "Retry Publish"})).toBeNull();
  });
});
