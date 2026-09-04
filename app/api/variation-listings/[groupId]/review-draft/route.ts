import {NextResponse} from "next/server";

import {
  SidecarApiError,
  updateVariationListingReviewDraft,
  type UpdateVariationListingReviewDraftInput,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

type RouteContext = {params: Promise<{groupId: string}>};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const {groupId} = await context.params;
    let rawInput: unknown;
    try {
      rawInput = await request.json();
    } catch {
      return NextResponse.json(
        {error: "invalid_request", message: "Review draft request body must be valid JSON."},
        {status: 400},
      );
    }
    if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
      return NextResponse.json(
        {error: "invalid_request", message: "Review draft request body must be a JSON object."},
        {status: 400},
      );
    }
    const input = rawInput as UpdateVariationListingReviewDraftInput;
    return NextResponse.json(await updateVariationListingReviewDraft(groupId, input));
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to save variation listing review draft.", error);
    }
    return NextResponse.json(
      {error: error instanceof SidecarApiError ? error.message : "An unexpected error occurred while saving the group review draft."},
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
