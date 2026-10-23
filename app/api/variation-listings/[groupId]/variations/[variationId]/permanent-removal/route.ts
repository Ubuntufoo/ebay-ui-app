import {NextResponse} from "next/server";

import {
  SidecarApiError,
  stageVariationListingPermanentRemoval,
  type StageVariationListingPermanentRemovalInput,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{groupId: string; variationId: string}>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const {groupId, variationId} = await context.params;
    const input = (await request.json()) as StageVariationListingPermanentRemovalInput;
    if (!input || !Number.isSafeInteger(input.expectedDesiredRevision) ||
        input.expectedDesiredRevision < 0 || typeof input.remove !== "boolean") {
      return NextResponse.json({error: "A valid revision and removal intent are required."}, {status: 400});
    }
    return NextResponse.json(await stageVariationListingPermanentRemoval(groupId, variationId, input));
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to stage/cancel variation sold-out removal.", error);
    }
    return NextResponse.json(
      {error: error instanceof SidecarApiError ? error.message : "An unexpected error occurred while updating sold-out removal."},
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
