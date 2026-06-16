import {NextResponse} from "next/server";

import {SidecarApiError, getAppSettings, getGeminiUsage, listListings} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const listings = await listListings();
    let geminiUsage = null;
    let geminiUsageStatus: "error" | "ready" = "ready";
    let soldCompsUsage = null;

    try {
      geminiUsage = await getGeminiUsage();
    } catch (error) {
      geminiUsageStatus = "error";

      if (!(error instanceof SidecarApiError)) {
        console.error("Failed to load Gemini usage for realtime refresh.", error);
      }
    }

    try {
      const appSettings = await getAppSettings();
      soldCompsUsage = appSettings.soldcomps_usage;
    } catch (error) {
      if (!(error instanceof SidecarApiError)) {
        console.error("Failed to load SoldComps usage for realtime refresh.", error);
      }
    }

    return NextResponse.json({
      geminiUsage,
      geminiUsageStatus,
      listings,
      soldCompsUsage,
    });
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
