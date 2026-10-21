import {NextResponse} from "next/server";

import {
  SidecarApiError,
  updateVariationListingQuantityAdjustment,
  type UpdateVariationListingQuantityAdjustmentInput,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{groupId: string; variationId: string}>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const {groupId, variationId} = await context.params;
    const input = (await request.json()) as UpdateVariationListingQuantityAdjustmentInput;
    return NextResponse.json(
      await updateVariationListingQuantityAdjustment(groupId, variationId, input),
    );
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to stage variation quantity adjustment.", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while staging the quantity adjustment.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
