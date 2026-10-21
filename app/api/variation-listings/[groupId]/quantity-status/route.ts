import {NextResponse} from "next/server";

import {
  SidecarApiError,
  getVariationListingQuantityStatus,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

type RouteContext = {params: Promise<{groupId: string}>};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const {groupId} = await context.params;
    return NextResponse.json(await getVariationListingQuantityStatus(groupId));
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to read variation quantity status.", error);
    }
    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while reading eBay quantity status.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
