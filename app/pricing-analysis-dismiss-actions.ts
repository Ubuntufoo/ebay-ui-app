"use server";

import {getActionErrorMessage} from "@/app/action-utils";
import {
  dismissPricingAnalysisWarnings as dismissPricingAnalysisWarningsRequest,
} from "@/lib/sidecar-api";
import type {Listing} from "@/lib/sidecar-api";

export type DismissPricingAnalysisWarningsResult =
  | {
      error: string;
      listing: null;
      success: false;
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
    return {
      error: getActionErrorMessage(
        error,
        "An unexpected error occurred while dismissing the pricing analysis warning.",
        {preferSidecarResponseMessage: true},
      ),
      listing: null,
      success: false,
    };
  }
}
