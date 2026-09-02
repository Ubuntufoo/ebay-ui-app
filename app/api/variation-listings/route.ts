import {NextResponse} from "next/server";

import {
  SidecarApiError,
  listVariationListingGroups,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const groups = await listVariationListingGroups();
    return NextResponse.json({groups});
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to load variation listing groups.", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while loading variation listings.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
