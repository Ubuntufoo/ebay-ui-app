"use server";

import {revalidatePath} from "next/cache";

import {getActionErrorMessage, readTrimmedFormField} from "@/app/action-utils";
import type {DeleteSandboxListingActionState} from "@/app/listing-sandbox-delete-state";
import {isStructuredSku} from "@/app/structured-sku-utils";
import {deleteSandboxListing} from "@/lib/sidecar-api";

export async function deleteSandboxListingAction(
  _previousState: DeleteSandboxListingActionState,
  formData: FormData,
): Promise<DeleteSandboxListingActionState> {
  const listingId = readTrimmedFormField(formData.get("listing_id"));
  const expectedSku = readTrimmedFormField(formData.get("expected_sku"));
  const expectedUpdatedAt = readTrimmedFormField(
    formData.get("expected_updated_at"),
  );

  if (!listingId) {
    return {
      deletedListingId: null,
      deletedSku: null,
      error: "Listing ID is required.",
      success: null,
    };
  }

  if (!isStructuredSku(expectedSku)) {
    return {
      deletedListingId: null,
      deletedSku: null,
      error: "A valid structured SKU is required.",
      success: null,
    };
  }

  if (!expectedUpdatedAt) {
    return {
      deletedListingId: null,
      deletedSku: null,
      error: "Listing updated time is required.",
      success: null,
    };
  }

  try {
    const response = await deleteSandboxListing(listingId, {
      expectedSku,
      expectedUpdatedAt,
    });
    revalidatePath("/");

    return {
      deletedListingId: response.listingId,
      deletedSku: response.sku,
      error: null,
      success: `Deleted sandbox listing ${response.sku}.`,
    };
  } catch (error) {
    return {
      deletedListingId: null,
      deletedSku: null,
      error: getActionErrorMessage(
        error,
        "An unexpected error occurred while deleting the sandbox listing.",
        {preferSidecarResponseMessage: true},
      ),
      success: null,
    };
  }
}
