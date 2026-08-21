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
});
