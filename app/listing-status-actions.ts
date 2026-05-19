"use server";

import {revalidatePath} from "next/cache";

import {
  isAllowedNextStatus,
  isManualTestStatus,
} from "@/app/listing-status-flow";
import {
  SidecarApiError,
  updateListingWorkflowState,
} from "@/lib/sidecar-api";

export interface UpdateListingStatusActionState {
  error: string | null;
  success: string | null;
}

export const initialUpdateListingStatusActionState: UpdateListingStatusActionState = {
  error: null,
  success: null,
};

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
    await updateListingWorkflowState(listingId, {
      status: nextStatus,
      subStatus: "idle",
    });
    revalidatePath("/");

    return {
      error: null,
      success: `Moved ${listingId} to ${nextStatus}.`,
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
