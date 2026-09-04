import {NextResponse} from "next/server";

import {SidecarApiError, generateVariationListingReviewDraft} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

type RouteContext = {params: Promise<{groupId: string}>};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const {groupId} = await context.params;
    return NextResponse.json(await generateVariationListingReviewDraft(groupId));
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to generate variation listing review draft.", error);
    }
    return NextResponse.json(
      {error: error instanceof SidecarApiError ? error.message : "An unexpected error occurred while generating the group review draft."},
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
