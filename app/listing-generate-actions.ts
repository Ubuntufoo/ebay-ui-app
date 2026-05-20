"use server";

import {revalidatePath} from "next/cache";

import type {GenerateListingActionState} from "@/app/listing-generate-state";
import {enqueueGenerateAiJob} from "@/lib/supabase/admin";

function readTextField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function enqueueGenerateListing(
  _previousState: GenerateListingActionState,
  formData: FormData,
): Promise<GenerateListingActionState> {
  const listingId = readTextField(formData.get("listing_id"));

  if (!listingId) {
    return {
      error: "Listing ID is required.",
      success: null,
    };
  }

  try {
    await enqueueGenerateAiJob(listingId);
    revalidatePath("/");

    return {
      error: null,
      success: `Queued generate_ai for ${listingId}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while queueing generate_ai.",
      success: null,
    };
  }
}
