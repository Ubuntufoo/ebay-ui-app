"use server";

import {revalidatePath} from "next/cache";

import {readTrimmedFormField, getActionErrorMessage} from "@/app/action-utils";
import type {Json, UpdateListingInput} from "@/lib/sidecar-api/types";
import {updateListing} from "@/lib/sidecar-api";
import type {SaveListingEditsActionState} from "@/app/listing-edit-state";
import {getListingPriceError} from "@/app/listing-price-validation";
import {
  applySportsCardSpecificDefaults,
  hasValidSportsCardSpecificValue,
  sanitizeSportsCardItemSpecifics,
  sportsCardSpecificFields,
  updateSportsCardSpecific,
} from "@/app/sports-card-item-specifics";

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

  const priceError = getListingPriceError(numeric);
  if (priceError) {
    return {value: null, error: priceError};
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

function readSportsCardSpecificChanges(
  value: FormDataEntryValue | null,
): {
  value: Record<string, string> | null;
  error: string | null;
} {
  if (typeof value !== "string") {
    return {value: null, error: null};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {value: null, error: "Item specific changes are invalid."};
    }

    const entries = Object.entries(parsed);
    const isValid = entries.every(
      ([key, entry]) =>
        typeof entry === "string" &&
        sportsCardSpecificFields.some((field) => field.persistKey === key),
    );

    return isValid
      ? {value: Object.fromEntries(entries), error: null}
      : {value: null, error: "Item specific changes are invalid."};
  } catch {
    return {value: null, error: "Item specific changes are invalid."};
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

    let updatedItemSpecifics = itemSpecificsResult.value;
    const categoryId = formData.has("category_id")
      ? readTrimmedFormField(formData.get("category_id"))
      : null;
    if (categoryId === "261328") {
      const defaultChangesResult = formData.has("sports_card_specific_default_changes")
        ? readSportsCardSpecificChanges(formData.get("sports_card_specific_default_changes"))
        : {value: null, error: null};
      if (defaultChangesResult.error) {
        return {
          error: defaultChangesResult.error,
          success: false,
        };
      }

      if (defaultChangesResult.value === null) {
        updatedItemSpecifics = applySportsCardSpecificDefaults(updatedItemSpecifics);
      }

      if (formData.has("sports_card_specific_changes")) {
        const changesResult = readSportsCardSpecificChanges(
          formData.get("sports_card_specific_changes"),
        );
        if (changesResult.error) {
          return {
            error: changesResult.error,
            success: false,
          };
        }

        const defaultChanges = defaultChangesResult.value ?? {};
        for (const field of sportsCardSpecificFields) {
          if (
            changesResult.value !== null &&
            Object.prototype.hasOwnProperty.call(
              changesResult.value,
              field.persistKey,
            )
          ) {
            if (
              Object.prototype.hasOwnProperty.call(defaultChanges, field.persistKey)
            ) {
              if (hasValidSportsCardSpecificValue(updatedItemSpecifics, field)) {
                continue;
              }
            }

            updatedItemSpecifics = updateSportsCardSpecific(
              updatedItemSpecifics,
              field,
              changesResult.value[field.persistKey] ?? "",
            );
          }
        }
      }
    }

    patch.itemSpecifics = sanitizeSportsCardItemSpecifics(
      updatedItemSpecifics,
      categoryId,
    );
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
      error: getActionErrorMessage(
        error,
        "An unexpected error occurred while saving listing edits.",
      ),
      success: false,
    };
  }
}
