"use server";

import {revalidatePath} from "next/cache";

import {getListingStatusLabel} from "@/app/listing-status-flow";
import type {ApproveListingForExportActionState} from "@/app/listing-approve-export-state";
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

export async function approveListingForExport(
  _previousState: ApproveListingForExportActionState,
  formData: FormData,
): Promise<ApproveListingForExportActionState> {
  const listingId = readTextField(formData.get("listing_id"));
  const currentStatus = readTextField(formData.get("current_status"));

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
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while approving listing for export.",
      success: null,
    };
  }
}
