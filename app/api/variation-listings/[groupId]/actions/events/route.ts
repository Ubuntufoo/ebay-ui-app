import "server-only";

import {getSidecarConfig} from "@/lib/config/sidecar";

type RouteContext = {params: Promise<{groupId: string}>};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const {groupId} = await context.params;
  if (!groupId || groupId.length > 200) {
    return Response.json({error: "not_found", message: "Variation listing group was not found."}, {status: 404});
  }

  const upstreamController = new AbortController();
  const abort = () => upstreamController.abort();
  request.signal.addEventListener("abort", abort, {once: true});
  try {
    const {apiUrl, bearerToken} = getSidecarConfig();
    const headers: HeadersInit = {Accept: "text/event-stream"};
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
    const response = await fetch(
      `${apiUrl}/api/variation-listings/${encodeURIComponent(groupId)}/actions/events`,
      {headers, cache: "no-store", signal: upstreamController.signal},
    );
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return Response.json(
        {error: "sidecar_error", message: "Unable to open variation listing action progress."},
        {status: response.ok ? 502 : response.status},
      );
    }
    const upstream = response.body;
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        const reader = upstream.getReader();
        const onAbort = () => { upstreamController.abort(); void reader.cancel(); };
        const cleanup = () => request.signal.removeEventListener("abort", onAbort);
        request.signal.addEventListener("abort", onAbort, {once: true});
        const pump = (): void => {
          void reader.read().then(({done, value}) => {
            if (done) { cleanup(); streamController.close(); return; }
            if (value) streamController.enqueue(value);
            pump();
          }).catch((error) => { cleanup(); streamController.error(error); });
        };
        pump();
      },
      cancel() { upstreamController.abort(); },
    });
    request.signal.removeEventListener("abort", abort);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    request.signal.removeEventListener("abort", abort);
    if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      return new Response(null, {status: 499});
    }
    console.error("Variation listing action events proxy failed.", error);
    return Response.json(
      {error: "server_error", message: "Unable to open variation listing action progress."},
      {status: 500},
    );
  }
}
