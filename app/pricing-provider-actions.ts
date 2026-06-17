"use server";

import {revalidatePath} from "next/cache";

import {getActionErrorMessage} from "@/app/action-utils";
import type {PricingProviderMode} from "@/lib/sidecar-api";
import {SidecarApiError, updateAppSettings} from "@/lib/sidecar-api";

export async function savePricingProviderMode(
  pricingProviderMode: PricingProviderMode,
): Promise<{error: string | null; success: boolean}> {
  try {
    await updateAppSettings({pricingProviderMode});
    revalidatePath("/");

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof SidecarApiError
          ? error.message
          : getActionErrorMessage(
              error,
              "An unexpected error occurred while saving pricing provider mode.",
            ),
      success: false,
    };
  }
}
