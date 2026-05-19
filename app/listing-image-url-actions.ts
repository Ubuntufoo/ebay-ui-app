"use server";

import {revalidatePath} from "next/cache";

import {initialSaveListingImageUrlsActionState} from "@/app/listing-image-url-state";
import {parseListingImageUrlsInput} from "@/app/listing-image-url-utils";
import {SidecarApiError, updateListingImageUrls} from "@/lib/sidecar-api";
import type {SaveListingImageUrlsActionState} from "@/app/listing-image-url-state";

function readTextField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function saveListingImageUrls(
  _previousState: SaveListingImageUrlsActionState,
  formData: FormData,
): Promise<SaveListingImageUrlsActionState> {
  const listingId = readTextField(formData.get("listing_id"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      success: false,
    };
  }

  const imageUrlsText =
    typeof formData.get("image_urls") === "string"
      ? (formData.get("image_urls") as string)
      : "";

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
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred while saving image URLs.",
      success: false,
    };
  }
}
