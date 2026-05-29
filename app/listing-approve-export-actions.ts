"use server";

import {revalidatePath} from "next/cache";

import {getActionErrorMessage, readTrimmedFormField} from "@/app/action-utils";
import {getListingStatusLabel} from "@/app/listing-status-flow";
import type {ApproveListingForExportActionState} from "@/app/listing-approve-export-state";
import {
  SidecarApiError,
  getListing,
  updateListingWorkflowState,
} from "@/lib/sidecar-api";

export async function approveListingForExport(
  _previousState: ApproveListingForExportActionState,
  formData: FormData,
): Promise<ApproveListingForExportActionState> {
  const listingId = readTrimmedFormField(formData.get("listing_id"));
  const currentStatus = readTrimmedFormField(formData.get("current_status"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      success: null,
    };
  }

  if (currentStatus !== "needs_review") {
    return {
      error: "Only listings in Needs review can be approved for export.",
      success: null,
    };
  }

  try {
    const listing = await getListing(listingId);

    if (listing.status !== currentStatus) {
      return {
        error: `Listing status changed to ${getListingStatusLabel(listing.status)}. Refresh and try again.`,
        success: null,
      };
    }

    await updateListingWorkflowState(listingId, {
      status: "approved_for_export",
      subStatus: "publish_queued",
    });
    revalidatePath("/");

    return {
      error: null,
      success: `Approved ${listingId} for export.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : getActionErrorMessage(
              error,
              "An unexpected error occurred while approving listing for export.",
            ),
      success: null,
    };
  }
}
