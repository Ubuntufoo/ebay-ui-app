"use server";

import { revalidatePath } from "next/cache";

import type { CreateListingActionState } from "@/app/create-listing-state";
import { createListing, SidecarApiError } from "@/lib/sidecar-api";

export async function submitCreateListing(
  _previousState: CreateListingActionState,
  formData: FormData
): Promise<CreateListingActionState> {
  const mode = formData.get("mode");

  if (mode !== "manual" && mode !== "test") {
    return {
      error: 'Choose either "manual" or "test" before creating a listing.',
      success: null,
    };
  }

  try {
    const listing = await createListing({ mode });
    revalidatePath("/");

    return {
      error: null,
      success: `Created ${listing.listing_id} in ${listing.status}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while creating the listing.",
      success: null,
    };
  }
}
