import {NextResponse} from "next/server";

import {
  getVariationListingCreationDefaults,
  SidecarApiError,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      creationDefaults: await getVariationListingCreationDefaults(),
    });
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to load variation listing creation defaults.", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while loading variation listing creation defaults.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
