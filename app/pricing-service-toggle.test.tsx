import {cleanup, render, screen, fireEvent, act} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const {togglePricingServiceActionMock} = vi.hoisted(() => ({
  togglePricingServiceActionMock: vi.fn(),
}));

vi.mock("@/app/pricing-service-toggle-actions", () => ({
  togglePricingServiceAction: togglePricingServiceActionMock,
}));

import {PricingServiceToggle} from "@/app/pricing-service-toggle";

function renderToggle(enabled: boolean) {
  return render(<PricingServiceToggle enabled={enabled} />);
}

afterEach(() => {
  cleanup();
});

describe("PricingServiceToggle", () => {
  beforeEach(() => {
    togglePricingServiceActionMock.mockReset();
  });

  it("renders enabled state copy", () => {
    renderToggle(true);

    expect(screen.getByText("Automatic pricing on")).not.toBeNull();
    expect(
      screen.getByRole("button", {name: "Disable automatic pricing"}),
    ).not.toBeNull();
  });

  it("renders disabled state copy", () => {
    renderToggle(false);

    expect(screen.getByText("Automatic pricing off")).not.toBeNull();
    expect(
      screen.getByRole("button", {name: "Enable automatic pricing"}),
    ).not.toBeNull();
  });

  it("renders unavailable form state when pricing status is unknown", () => {
    render(<PricingServiceToggle enabled={null} />);

    expect(screen.getByText("Automatic pricing unavailable")).not.toBeNull();
    expect(screen.getByRole("button", {name: "Pricing unavailable"})).not.toBeNull();
  });

  it("submits the next enabled value and shows pending state", async () => {
    let resolveAction:
      | ((value: {enabled: boolean; error: string | null; success: string | null}) => void)
      | null = null;

    togglePricingServiceActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    renderToggle(true);

    const button = screen.getByRole("button", {
      name: "Disable automatic pricing",
    });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(togglePricingServiceActionMock).toHaveBeenCalledTimes(1);

    const submittedFormData = togglePricingServiceActionMock.mock.calls[0]?.[1] as FormData;
    expect(submittedFormData.get("pricingServiceEnabled")).toBe("false");
    expect(screen.getByRole("button", {name: "Saving..."})).not.toBeNull();

    await act(async () => {
      resolveAction?.({
        enabled: false,
        error: null,
        success: "Automatic pricing disabled.",
      });
    });

    expect(
      screen.getByRole("button", {name: "Enable automatic pricing"}),
    ).not.toBeNull();
    expect(screen.getByText("Automatic pricing off")).not.toBeNull();
    expect(screen.getByText("Automatic pricing disabled.")).not.toBeNull();
  });

  it("shows action errors without changing displayed state", async () => {
    togglePricingServiceActionMock.mockResolvedValueOnce({
      enabled: true,
      error: "Pricing update failed.",
      success: null,
    });

    renderToggle(true);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {name: "Disable automatic pricing"}),
      );
    });

    expect(screen.getByText("Pricing update failed.")).not.toBeNull();
    expect(screen.getByText("Automatic pricing on")).not.toBeNull();
    expect(
      screen.getByRole("button", {name: "Disable automatic pricing"}),
    ).not.toBeNull();
  });
});
