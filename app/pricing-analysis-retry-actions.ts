"use server";

export type RetryPricingAnalysisResult = {
  error: string | null;
  success: boolean;
};

/**
 * Retries pricing analysis for a listing with pricing-analysis warnings.
 *
 * Stub implementation for roadmap 9J.19 — the backend retry endpoint (9J.20)
 * is not yet available. This stub always returns a clear failure message to
 * prevent misleading success states. When the backend endpoint is ready,
 * replace the body with a real sidecar API call:
 *
 *   const { error, success } = await sidecarFetch(
 *     `/api/listings/${encodeURIComponent(listingId)}/retry-pricing-analysis`,
 *     { method: "POST" },
 *   );
 */
export async function retryPricingAnalysis(
  _listingId: string,
): Promise<RetryPricingAnalysisResult> {
  void _listingId;
  // TODO (9J.20): Replace stub with real sidecar API call.
  return {
    error: "Pricing analysis retry is not available yet.",
    success: false,
  };
}
