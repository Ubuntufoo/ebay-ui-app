"use server";

import {revalidatePath} from "next/cache";

import {getActionErrorMessage, readTrimmedFormField} from "@/app/action-utils";
import {initialSaveListingImageUrlsActionState} from "@/app/listing-image-url-state";
import {parseListingImageUrlsInput} from "@/app/listing-image-url-utils";
import {SidecarApiError, updateListingImageUrls} from "@/lib/sidecar-api";
import type {SaveListingImageUrlsActionState} from "@/app/listing-image-url-state";

export async function saveListingImageUrls(
  _previousState: SaveListingImageUrlsActionState,
  formData: FormData,
): Promise<SaveListingImageUrlsActionState> {
  const listingId = readTrimmedFormField(formData.get("listing_id"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      success: false,
    };
  }

  const imageUrlsText = readTrimmedFormField(formData.get("image_urls")) ?? "";

  const {invalidUrls, urls} = parseListingImageUrlsInput(imageUrlsText);

  if (invalidUrls.length > 0) {
    return {
      error: `Each image URL must be a valid http or https URL. Invalid entries: ${invalidUrls.join(", ")}`,
      success: false,
    };
  }

  try {
    await updateListingImageUrls(listingId, {imageUrls: urls});
    revalidatePath("/");

    return {
      ...initialSaveListingImageUrlsActionState,
      success: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : getActionErrorMessage(
              error,
              "An unexpected error occurred while saving image URLs.",
            ),
      success: false,
    };
  }
}
