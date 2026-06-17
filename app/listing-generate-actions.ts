"use server";

import {revalidatePath} from "next/cache";

import {getActionErrorMessage, readTrimmedFormField} from "@/app/action-utils";
import {toPricingModifierOptions} from "@/app/listing-pricing-modifier-options";
import {getListingStatusLabel} from "@/app/listing-status-flow";
import type {GenerateListingActionState} from "@/app/listing-generate-state";
import type {ListingPricingModifierUiState} from "@/app/listing-pricing-modifier-options";
import type {PricingModifierOptions} from "@/lib/sidecar-api";
import {enqueueGenerateAi, SidecarApiError, updateListing} from "@/lib/sidecar-api";

function readPricingModifierCheckbox(
  formData: FormData,
  fieldName: string,
): boolean | undefined {
  const rawValue = formData.get(fieldName);

  if (rawValue === null) {
    return undefined;
  }

  return rawValue === "true";
}

function readPricingModifierOptions(
  formData: FormData,
): PricingModifierOptions | undefined {
  const excludeGraded = readPricingModifierCheckbox(formData, "exclude_graded");
  const excludeAutographs = readPricingModifierCheckbox(
    formData,
    "exclude_autographs",
  );
  const excludeVariants = readPricingModifierCheckbox(
    formData,
    "exclude_variants",
  );

  if (
    excludeGraded === undefined &&
    excludeAutographs === undefined &&
    excludeVariants === undefined
  ) {
    return undefined;
  }

  return {
    excludeAutographs,
    excludeGraded,
    excludeVariants,
  };
}

export async function saveListingPricingModifierOptions(
  listingId: string,
  state: ListingPricingModifierUiState,
): Promise<{error: string | null}> {
  try {
    await updateListing(listingId, {
      pricingModifierOptions: toPricingModifierOptions(state),
    });
    revalidatePath("/");

    return {error: null};
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : getActionErrorMessage(
              error,
              "An unexpected error occurred while saving pricing modifiers.",
            ),
    };
  }
}

export async function enqueueGenerateListing(
  _previousState: GenerateListingActionState,
  formData: FormData,
): Promise<GenerateListingActionState> {
  const listingId = readTrimmedFormField(formData.get("listing_id"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      info: null,
      success: null,
    };
  }

  try {
    const sellerHints = readTrimmedFormField(formData.get("seller_hints"));
    const pricingModifierOptions = readPricingModifierOptions(formData);

    if (pricingModifierOptions) {
      await updateListing(listingId, {pricingModifierOptions});
    }

    const result = await enqueueGenerateAi(listingId, {
      sellerHints,
    });
    revalidatePath("/");

    if (result.alreadyQueued) {
      return {
        error: null,
        info: `Generate AI Draft already queued or running for ${listingId}. Listing now ${getListingStatusLabel(result.listing.status)}.`,
        success: null,
      };
    }

    return {
      error: null,
      info: null,
      success: `Queued Generate AI Draft for ${listingId}. Listing now ${getListingStatusLabel(result.listing.status)}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : getActionErrorMessage(
              error,
              "An unexpected error occurred while queueing Generate AI Draft.",
            ),
      info: null,
      success: null,
    };
  }
}
