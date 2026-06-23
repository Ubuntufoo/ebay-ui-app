"use server";

import {
  dismissPricingAnalysisWarnings as dismissPricingAnalysisWarningsRequest,
  SidecarApiError,
} from "@/lib/sidecar-api";
import type {Listing} from "@/lib/sidecar-api";

export type DismissPricingAnalysisWarningsResult =
  | {
      error: string | null;
      listing: null;
      success: boolean;
    }
  | {
      error: null;
      listing: Listing;
      success: true;
    };

export async function dismissPricingAnalysisWarnings(
  listingId: string,
  codes: string[],
): Promise<DismissPricingAnalysisWarningsResult> {
  try {
    const listing = await dismissPricingAnalysisWarningsRequest(
      listingId,
      codes,
    );
    return {
      error: null,
      listing,
      success: true,
    };
  } catch (error) {
    if (error instanceof SidecarApiError) {
      return {
        error:
          error.response?.message ?? error.response?.error ?? error.message,
        listing: null,
        success: false,
      };
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while dismissing the pricing analysis warning.",
      listing: null,
      success: false,
    };
  }
}
