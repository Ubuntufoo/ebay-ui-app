"use server";

import {
  retryPricingAnalysis as retryPricingAnalysisRequest,
  SidecarApiError,
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
    if (error instanceof SidecarApiError) {
      return {
        error: error.response?.message ?? error.response?.error ?? error.message,
        success: false,
      };
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while retrying pricing analysis.",
      success: false,
    };
  }
}
