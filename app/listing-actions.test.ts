import {beforeEach, describe, expect, it, vi} from "vitest";

const {revalidatePathMock, updateListingMock} = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  updateListingMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/sidecar-api", () => ({
  updateListing: updateListingMock,
}));

import {saveListingEdits} from "@/app/listing-actions";

function buildFormData(price: string): FormData {
  const formData = new FormData();
  formData.set("listing_id", "LIST-001");
  formData.set("price", price);
  return formData;
}

describe("saveListingEdits price validation", () => {
  beforeEach(() => {
    revalidatePathMock.mockReset();
    updateListingMock.mockReset();
  });

  it("rejects prices below $0.99 before updating the listing", async () => {
    const result = await saveListingEdits(
      {error: null, success: false},
      buildFormData("0.95"),
    );

    expect(result).toEqual({
      error: "Price must be at least $0.99.",
      success: false,
    });
    expect(updateListingMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("accepts the $0.99 minimum price", async () => {
    updateListingMock.mockResolvedValueOnce(undefined);

    const result = await saveListingEdits(
      {error: null, success: false},
      buildFormData("0.99"),
    );

    expect(result).toEqual({error: null, success: true});
    expect(updateListingMock).toHaveBeenCalledWith("LIST-001", {
      price: 0.99,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("merges changed structured specifics into the main item specifics payload", async () => {
    updateListingMock.mockResolvedValueOnce(undefined);
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("category_id", "261328");
    formData.set(
      "item_specifics",
      JSON.stringify({
        Manufacturer: "Topps",
        Player: "Mike Trout",
        customField: "preserved",
      }),
    );
    formData.set(
      "sports_card_specific_changes",
      JSON.stringify({Manufacturer: "Panini", Franchise: "Boston Red Sox"}),
    );
    formData.set("sports_card_specific_default_changes", JSON.stringify({}));

    const result = await saveListingEdits(
      {error: null, success: false},
      formData,
    );

    expect(result).toEqual({error: null, success: true});
    expect(updateListingMock).toHaveBeenCalledWith("LIST-001", {
      categoryId: "261328",
      itemSpecifics: {
        Manufacturer: "Panini",
        Player: "Mike Trout",
        Franchise: "Boston Red Sox",
        customField: "preserved",
      },
    });
  });

  it.each([
    ["invalid scalar", "No", "Original"],
    ["invalid multi-value", ["Licensed Reprint", "Original"], "Original"],
    ["valid selection", "Licensed Reprint", "Licensed Reprint"],
  ])(
    "validates Original/Licensed Reprint before merging a %s saved value",
    async (_label, savedValue, expectedValue) => {
      updateListingMock.mockResolvedValueOnce(undefined);
      const formData = new FormData();
      formData.set("listing_id", "LIST-001");
      formData.set("category_id", "261328");
      formData.set(
        "item_specifics",
        JSON.stringify({"Original/Licensed Reprint": savedValue}),
      );
      formData.set(
        "sports_card_specific_changes",
        JSON.stringify({"Original/Licensed Reprint": "Original"}),
      );
      formData.set(
        "sports_card_specific_default_changes",
        JSON.stringify({"Original/Licensed Reprint": "Original"}),
      );

      const result = await saveListingEdits(
        {error: null, success: false},
        formData,
      );

      expect(result).toEqual({error: null, success: true});
      expect(updateListingMock).toHaveBeenCalledWith("LIST-001", {
        categoryId: "261328",
        itemSpecifics: {"Original/Licensed Reprint": expectedValue},
      });
    },
  );

  it("persists the missing Autographed default through Save edits", async () => {
    updateListingMock.mockResolvedValueOnce(undefined);
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");
    formData.set("category_id", "261328");
    formData.set("item_specifics", JSON.stringify({Player: "Mike Trout"}));
    formData.set(
      "sports_card_specific_changes",
      JSON.stringify({Autographed: "No"}),
    );
    formData.set(
      "sports_card_specific_default_changes",
      JSON.stringify({Autographed: "No"}),
    );

    const result = await saveListingEdits(
      {error: null, success: false},
      formData,
    );

    expect(result).toEqual({error: null, success: true});
    expect(updateListingMock).toHaveBeenCalledWith("LIST-001", {
      categoryId: "261328",
      itemSpecifics: {Player: "Mike Trout", Autographed: "No"},
    });
  });
});
