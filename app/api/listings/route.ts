import {NextResponse} from "next/server";

import {SidecarApiError, getGeminiUsage, listListings} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const listings = await listListings();
    let geminiUsage = null;
    let geminiUsageStatus: "error" | "ready" = "ready";

    try {
      geminiUsage = await getGeminiUsage();
    } catch (error) {
      geminiUsageStatus = "error";

      if (!(error instanceof SidecarApiError)) {
        console.error("Failed to load Gemini usage for realtime refresh.", error);
      }
    }

    return NextResponse.json({geminiUsage, geminiUsageStatus, listings});
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to load listings for realtime refresh.", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while loading listings.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
