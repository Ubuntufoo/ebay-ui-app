import {NextResponse} from "next/server";

import {
  SidecarApiError,
  updateVariationListingRepresentativeCopy,
  type UpdateVariationListingRepresentativeCopyInput,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{groupId: string; variationId: string}>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const {groupId, variationId} = await context.params;
    const input = (await request.json()) as UpdateVariationListingRepresentativeCopyInput;
    return NextResponse.json(
      await updateVariationListingRepresentativeCopy(groupId, variationId, input),
    );
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to update variation representative copy.", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while updating the representative copy.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
