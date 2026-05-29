"use server";

import {revalidatePath} from "next/cache";

import {readTrimmedFormField, getActionErrorMessage} from "@/app/action-utils";
import type {Json, UpdateListingInput} from "@/lib/sidecar-api/types";
import {SidecarApiError, updateListing} from "@/lib/sidecar-api";
import type {SaveListingEditsActionState} from "@/app/listing-edit-state";

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
  const listingId = readTrimmedFormField(formData.get("listing_id"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      success: false,
    };
  }

  const patch: UpdateListingInput = {};

  if (formData.has("title")) {
    patch.title = readTrimmedFormField(formData.get("title"));
  }

  if (formData.has("seller_hints")) {
    patch.sellerHints = readTrimmedFormField(formData.get("seller_hints"));
  }

  if (formData.has("description")) {
    patch.description = readTrimmedFormField(formData.get("description"));
  }

  if (formData.has("category_id")) {
    patch.categoryId = readTrimmedFormField(formData.get("category_id"));
  }

  if (formData.has("condition_id")) {
    patch.conditionId = readTrimmedFormField(formData.get("condition_id"));
  }

  if (formData.has("condition_notes")) {
    patch.conditionNotes = readTrimmedFormField(formData.get("condition_notes"));
  }

  if (formData.has("price")) {
    const priceResult = readNumericField(formData.get("price"));
    if (priceResult.error) {
      return {
        error: priceResult.error,
        success: false,
      };
    }
    patch.price = priceResult.value;
  }

  if (formData.has("item_specifics")) {
    const itemSpecificsResult = readItemSpecificsField(
      formData.get("item_specifics"),
    );
    if (itemSpecificsResult.error) {
      return {
        error: itemSpecificsResult.error,
        success: false,
      };
    }
    patch.itemSpecifics = itemSpecificsResult.value;
  }

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
          : getActionErrorMessage(
              error,
              "An unexpected error occurred while saving listing edits.",
            ),
      success: false,
    };
  }
}
