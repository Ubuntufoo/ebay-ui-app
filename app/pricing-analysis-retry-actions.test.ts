import {beforeEach, describe, expect, it, vi} from "vitest";

const {retryPricingAnalysisMock} = vi.hoisted(() => ({
  retryPricingAnalysisMock: vi.fn(),
}));

vi.mock("@/lib/sidecar-api", () => ({
  SidecarApiError: class SidecarApiError extends Error {
    response?: {error?: string; message?: string};
    status: number;

    constructor(
      message: string,
      status: number,
      response?: {error?: string; message?: string},
    ) {
      super(message);
      this.name = "SidecarApiError";
      this.status = status;
      this.response = response;
    }
  },
  retryPricingAnalysis: retryPricingAnalysisMock,
}));

import {retryPricingAnalysis} from "@/app/pricing-analysis-retry-actions";

describe("retryPricingAnalysis action", () => {
  beforeEach(() => {
    retryPricingAnalysisMock.mockReset();
  });

  it("returns success on 2xx retry response", async () => {
    retryPricingAnalysisMock.mockResolvedValue({message: "Retry queued."});

    await expect(retryPricingAnalysis("LIST-001")).resolves.toEqual({
      error: null,
      success: true,
    });
  });

  it("surfaces backend message on retry failure", async () => {
    retryPricingAnalysisMock.mockRejectedValue(
      new Error("Rate limit exceeded for pricing provider."),
    );

    await expect(retryPricingAnalysis("LIST-001")).resolves.toEqual({
      error: "Rate limit exceeded for pricing provider.",
      success: false,
    });
  });
});
