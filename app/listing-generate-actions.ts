"use server";

import {revalidatePath} from "next/cache";

import {getListingStatusLabel} from "@/app/listing-status-flow";
import type {GenerateListingActionState} from "@/app/listing-generate-state";
import {enqueueGenerateAi, SidecarApiError} from "@/lib/sidecar-api";

function readTextField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function enqueueGenerateListing(
  _previousState: GenerateListingActionState,
  formData: FormData,
): Promise<GenerateListingActionState> {
  const listingId = readTextField(formData.get("listing_id"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      info: null,
      success: null,
    };
  }

  try {
    const sellerHints = readTextField(formData.get("seller_hints"));
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
          : error instanceof Error
          ? error.message
          : "An unexpected error occurred while queueing Generate AI Draft.",
      info: null,
      success: null,
    };
  }
}
