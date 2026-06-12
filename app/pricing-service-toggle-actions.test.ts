import {beforeEach, describe, expect, it, vi} from "vitest";

import {
  createPricingServiceToggleActionState,
  type PricingServiceToggleActionState,
} from "@/app/pricing-service-toggle-state";
import {togglePricingServiceAction} from "@/app/pricing-service-toggle-actions";

const {
  revalidatePathMock,
  updatePricingServiceEnabledMock,
} = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  updatePricingServiceEnabledMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/sidecar-api", () => ({
  SidecarApiError: class SidecarApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "SidecarApiError";
      this.status = status;
    }
  },
  updatePricingServiceEnabled: updatePricingServiceEnabledMock,
}));

describe("togglePricingServiceAction", () => {
  beforeEach(() => {
    revalidatePathMock.mockReset();
    updatePricingServiceEnabledMock.mockReset();
  });

  it("enables pricing service when form submits true", async () => {
    updatePricingServiceEnabledMock.mockResolvedValueOnce({
      pricing_service_enabled: true,
    });
    const previousState: PricingServiceToggleActionState =
      createPricingServiceToggleActionState(false);
    const formData = new FormData();
    formData.set("pricingServiceEnabled", "true");

    const result = await togglePricingServiceAction(previousState, formData);

    expect(updatePricingServiceEnabledMock).toHaveBeenCalledWith(true);
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      enabled: true,
      error: null,
      success: "Automatic pricing enabled.",
    });
  });

  it("returns prior state and surfaces SidecarApiError messages", async () => {
    const {SidecarApiError} = await import("@/lib/sidecar-api");
    updatePricingServiceEnabledMock.mockRejectedValueOnce(
      new SidecarApiError("Sidecar request failed.", 500),
    );
    const previousState: PricingServiceToggleActionState =
      createPricingServiceToggleActionState(true);
    const formData = new FormData();
    formData.set("pricingServiceEnabled", "false");

    const result = await togglePricingServiceAction(previousState, formData);

    expect(updatePricingServiceEnabledMock).toHaveBeenCalledWith(false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      enabled: true,
      error: "Sidecar request failed.",
      success: null,
    });
  });

  it("rejects missing or invalid form values", async () => {
    const previousState: PricingServiceToggleActionState =
      createPricingServiceToggleActionState(true);

    const result = await togglePricingServiceAction(previousState, new FormData());

    expect(updatePricingServiceEnabledMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      enabled: true,
      error: "Pricing service value is required.",
      success: null,
    });
  });
});
