import {NextResponse} from "next/server";

import {
  configureVariationListingIntake,
  getVariationListingIntakeSession,
  SidecarApiError,
  type ConfigureVariationListingIntakeInput,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getVariationListingIntakeSession());
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to load variation listing intake session.", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while loading the intake session.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const input = (await request.json()) as ConfigureVariationListingIntakeInput;
    return NextResponse.json({session: await configureVariationListingIntake(input)});
  } catch (error) {
    if (!(error instanceof SidecarApiError)) {
      console.error("Failed to configure variation listing intake.", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof SidecarApiError
            ? error.message
            : "An unexpected error occurred while configuring the intake session.",
      },
      {status: error instanceof SidecarApiError ? error.status : 500},
    );
  }
}
