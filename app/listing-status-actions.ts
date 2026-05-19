"use server";

import {revalidatePath} from "next/cache";

import {
  getListingStatusLabel,
  isAllowedNextStatus,
  isManualTestStatus,
} from "@/app/listing-status-flow";
import type {UpdateListingStatusActionState} from "@/app/listing-status-state";
import {
  SidecarApiError,
  getListing,
  updateListingWorkflowState,
} from "@/lib/sidecar-api";

function readTextField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function updateListingStatus(
  _previousState: UpdateListingStatusActionState,
  formData: FormData,
): Promise<UpdateListingStatusActionState> {
  const listingId = readTextField(formData.get("listing_id"));
  const currentStatus = readTextField(formData.get("current_status"));
  const nextStatus = readTextField(formData.get("next_status"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      success: null,
    };
  }

  if (!currentStatus || !isManualTestStatus(currentStatus)) {
    return {
      error: "Current status is not eligible for the manual test flow.",
      success: null,
    };
  }

  if (!nextStatus || !isAllowedNextStatus(currentStatus, nextStatus)) {
    return {
      error: "Requested status transition is not allowed.",
      success: null,
    };
  }

  try {
    const listing = await getListing(listingId);

    if (currentStatus !== listing.status) {
      return {
        error: `Listing status changed to ${getListingStatusLabel(listing.status)}. Refresh and try again.`,
        success: null,
      };
    }

    if (!isManualTestStatus(listing.status)) {
      return {
        error: "Current status is not eligible for the manual test flow.",
        success: null,
      };
    }

    if (!isAllowedNextStatus(listing.status, nextStatus)) {
      return {
        error: "Requested status transition is not allowed.",
        success: null,
      };
    }

    await updateListingWorkflowState(listingId, {
      status: nextStatus,
      // Manual test controls intentionally normalize to the canonical fallback
      // state for each phase instead of simulating backend worker sub-states.
      subStatus: "idle",
    });
    revalidatePath("/");

    return {
      error: null,
      success: `Moved ${listingId} to ${getListingStatusLabel(nextStatus)}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while updating listing status.",
      success: null,
    };
  }
}
