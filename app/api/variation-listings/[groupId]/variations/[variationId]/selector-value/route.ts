import {NextResponse} from "next/server";

import {
  SidecarApiError,
  updateVariationListingSelectorValue,
  type UpdateVariationListingSelectorValueInput,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

type RouteContext = {params: Promise<{groupId: string; variationId: string}>};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const {groupId, variationId} = await context.params;
    let rawInput: unknown;
    try {
      rawInput = await request.json();
    } catch {
      return NextResponse.json(
        {error: "invalid_request", message: "Selector value request body must be valid JSON."},
        {status: 400},
      );
    }
    if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
      return NextResponse.json(
        {error: "invalid_request", message: "Selector value request body must be a JSON object."},
        {status: 400},
      );
    }
    const input = rawInput as UpdateVariationListingSelectorValueInput;
    return NextResponse.json(await updateVariationListingSelectorValue(groupId, variationId, input));
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to update variation title.", error);
    }
    return NextResponse.json(
      {error: error instanceof SidecarApiError ? error.message : "An unexpected error occurred while updating the variation title."},
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
