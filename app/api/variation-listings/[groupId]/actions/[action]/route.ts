import {NextResponse} from "next/server";

import {
  runVariationListingAction,
  SidecarApiError,
  type VariationListingActionInput,
  type VariationListingActionRouteName,
} from "@/lib/sidecar-api";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<VariationListingActionRouteName>([
  "publish",
  "publish-changes",
  "retry",
  "quantity",
  "withdraw",
  "abandon",
  "cleanup",
]);

type RouteContext = {
  params: Promise<{groupId: string; action: string}>;
};

export async function POST(request: Request, context: RouteContext) {
  const {groupId, action: rawAction} = await context.params;
  if (!ACTIONS.has(rawAction as VariationListingActionRouteName)) {
    return NextResponse.json({error: "not_found", message: "Unknown variation listing action."}, {status: 404});
  }

  let input: VariationListingActionInput = {};
  try {
    const text = await request.text();
    if (text.trim()) input = JSON.parse(text) as VariationListingActionInput;
  } catch {
    return NextResponse.json({error: "invalid_request", message: "Action request body must be valid JSON."}, {status: 400});
  }

  try {
    return NextResponse.json(
      await runVariationListingAction(
        groupId,
        rawAction as VariationListingActionRouteName,
        input,
      ),
    );
  } catch (error) {
    if (error instanceof SidecarApiError) {
      return NextResponse.json(
        error.response ?? {error: "sidecar_error", message: error.message},
        {status: error.status},
      );
    }

    console.error("Variation listing action proxy failed.", error);
    return NextResponse.json(
      {error: "server_error", message: "An unexpected error occurred while running the variation listing action."},
      {status: 500},
    );
  }
}
