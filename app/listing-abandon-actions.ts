"use server";

import {revalidatePath} from "next/cache";

import {getActionErrorMessage, readTrimmedFormField} from "@/app/action-utils";
import type {AbandonListingActionState} from "@/app/listing-abandon-state";
import {abandonListing} from "@/lib/sidecar-api";

export async function abandonListingAction(
  _previousState: AbandonListingActionState,
  formData: FormData,
): Promise<AbandonListingActionState> {
  const listingId = readTrimmedFormField(formData.get("listing_id"));

  if (!listingId) {
    return {
      abandonedListingId: null,
      error: "Listing ID is required.",
      success: null,
    };
  }

  try {
    const response = await abandonListing(listingId);
    revalidatePath("/");

    return {
      abandonedListingId: response.listingId,
      error: null,
      success: `Abandoned ${response.listingId}.`,
    };
  } catch (error) {
    return {
      abandonedListingId: null,
      error: getActionErrorMessage(
        error,
        "An unexpected error occurred while abandoning the listing.",
        {preferSidecarResponseMessage: true},
      ),
      success: null,
    };
  }
}
