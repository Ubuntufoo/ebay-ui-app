import {NextResponse} from "next/server";

import {SidecarApiError, listListings} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const listings = await listListings();

    return NextResponse.json({listings});
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "An unexpected error occurred while loading listings.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
