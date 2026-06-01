import {NextResponse} from "next/server";

import {SidecarApiError, getEbayEnvironment} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ebayEnvironment = await getEbayEnvironment();

    return NextResponse.json(ebayEnvironment);
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to load eBay environment.", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while loading the eBay environment.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
