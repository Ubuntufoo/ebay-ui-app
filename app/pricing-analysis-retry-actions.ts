"use server";

import {getActionErrorMessage} from "@/app/action-utils";
import {
  retryPricingAnalysis as retryPricingAnalysisRequest,
} from "@/lib/sidecar-api";

export type RetryPricingAnalysisResult = {
  error: string | null;
  success: boolean;
};

export async function retryPricingAnalysis(
  listingId: string,
): Promise<RetryPricingAnalysisResult> {
  try {
    await retryPricingAnalysisRequest(listingId);
    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        "An unexpected error occurred while retrying pricing analysis.",
        {preferSidecarResponseMessage: true},
      ),
      success: false,
    };
  }
}
