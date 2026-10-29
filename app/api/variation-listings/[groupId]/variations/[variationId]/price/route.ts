import {NextResponse} from "next/server";

import {SidecarApiError, updateVariationListingPrice, type UpdateVariationListingPriceInput} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";
type RouteContext = {params: Promise<{groupId: string; variationId: string}>};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const {groupId, variationId} = await context.params;
    const input = (await request.json()) as UpdateVariationListingPriceInput;
    return NextResponse.json(await updateVariationListingPrice(groupId, variationId, input));
  } catch (error) {
    if (!(error instanceof SidecarApiError)) console.error("Failed to update variation price.", error);
    return NextResponse.json(
      {error: error instanceof SidecarApiError ? error.message : "An unexpected error occurred while updating the variation price."},
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
