"use server";

import {revalidatePath} from "next/cache";

import {getActionErrorMessage, readTrimmedFormField} from "@/app/action-utils";
import {
  createPricingServiceToggleActionState,
  type PricingServiceToggleActionState,
} from "@/app/pricing-service-toggle-state";
import {
  SidecarApiError,
  updatePricingServiceEnabled,
} from "@/lib/sidecar-api";

function readPricingServiceEnabledField(
  value: FormDataEntryValue | null,
): boolean | null {
  const rawValue = readTrimmedFormField(value);

  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  return null;
}

export async function togglePricingServiceAction(
  previousState: PricingServiceToggleActionState,
  formData: FormData,
): Promise<PricingServiceToggleActionState> {
  const nextEnabled = readPricingServiceEnabledField(
    formData.get("pricingServiceEnabled"),
  );

  if (nextEnabled === null) {
    return {
      ...previousState,
      error: "Pricing service value is required.",
      success: null,
    };
  }

  try {
    const settings = await updatePricingServiceEnabled(nextEnabled);
    revalidatePath("/");

    return {
      enabled: settings.pricing_service_enabled,
      error: null,
      success: nextEnabled
        ? "Automatic pricing enabled."
        : "Automatic pricing disabled.",
    };
  } catch (error) {
    return {
      ...createPricingServiceToggleActionState(previousState.enabled),
      error:
        error instanceof SidecarApiError
          ? error.message
          : getActionErrorMessage(
              error,
              "An unexpected error occurred while updating pricing service.",
            ),
    };
  }
}
