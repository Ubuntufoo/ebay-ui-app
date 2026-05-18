"use server";

import {revalidatePath} from "next/cache";

import {SidecarApiError, updateListing} from "@/lib/sidecar-api";
import type {Json, UpdateListingInput} from "@/lib/sidecar-api/types";

export interface SaveListingEditsActionState {
  error: string | null;
  success: boolean;
}

function readTextField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function readNumericField(value: FormDataEntryValue | null): {
  value: number | null;
  error: string | null;
} {
  if (typeof value !== "string") {
    return {value: null, error: null};
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return {value: null, error: null};
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return {value: null, error: "Price must be a valid number."};
  }

  return {value: numeric, error: null};
}

function readItemSpecificsField(value: FormDataEntryValue | null): {
  value: Json;
  error: string | null;
} {
  if (typeof value !== "string") {
    return {value: null, error: null};
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return {value: null, error: null};
  }

  try {
    return {value: JSON.parse(trimmed) as Json, error: null};
  } catch {
    return {
      value: null,
      error: "Item specifics must be valid JSON.",
    };
  }
}

export async function saveListingEdits(
  _previousState: SaveListingEditsActionState,
  formData: FormData,
): Promise<SaveListingEditsActionState> {
  const listingId = readTextField(formData.get("listing_id"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      success: false,
    };
  }

  const title = readTextField(formData.get("title"));
  const sellerHints = readTextField(formData.get("seller_hints"));
  const description = readTextField(formData.get("description"));
  const categoryId = readTextField(formData.get("category_id"));
  const conditionId = readTextField(formData.get("condition_id"));
  const conditionNotes = readTextField(formData.get("condition_notes"));

  const priceResult = readNumericField(formData.get("price"));
  if (priceResult.error) {
    return {
      error: priceResult.error,
      success: false,
    };
  }

  const itemSpecificsResult = readItemSpecificsField(
    formData.get("item_specifics"),
  );
  if (itemSpecificsResult.error) {
    return {
      error: itemSpecificsResult.error,
      success: false,
    };
  }

  const patch: UpdateListingInput = {
    categoryId,
    conditionId,
    conditionNotes,
    description,
    itemSpecifics: itemSpecificsResult.value,
    price: priceResult.value,
    sellerHints,
    title,
  };

  try {
    await updateListing(listingId, patch);
    revalidatePath("/");

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while saving listing edits.",
      success: false,
    };
  }
}
