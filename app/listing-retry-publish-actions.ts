"use server";

import {revalidatePath} from "next/cache";

import {getActionErrorMessage, readTrimmedFormField} from "@/app/action-utils";
import type {RetryPublishListingActionState} from "@/app/listing-retry-publish-state";
import {retryPublishListing, SidecarApiError} from "@/lib/sidecar-api";

export async function retryPublishListingAction(
  _previousState: RetryPublishListingActionState,
  formData: FormData,
): Promise<RetryPublishListingActionState> {
  const listingId = readTrimmedFormField(formData.get("listing_id"));

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
          : getActionErrorMessage(
              error,
              "An unexpected error occurred while retrying publish.",
            ),
      success: null,
    };
  }
}
