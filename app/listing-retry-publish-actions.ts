"use server";

import {revalidatePath} from "next/cache";

import type {RetryPublishListingActionState} from "@/app/listing-retry-publish-state";
import {retryPublishListing, SidecarApiError} from "@/lib/sidecar-api";

function readTextField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function retryPublishListingAction(
  _previousState: RetryPublishListingActionState,
  formData: FormData,
): Promise<RetryPublishListingActionState> {
  const listingId = readTextField(formData.get("listing_id"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      success: null,
    };
  }

  try {
    const result = await retryPublishListing(listingId);
    revalidatePath("/");

    return {
      error: null,
      success: result.alreadyQueued
        ? `Retry publish is already queued or running for ${listingId}.`
        : `Retry publish queued for ${listingId}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while retrying publish.",
      success: null,
    };
  }
}