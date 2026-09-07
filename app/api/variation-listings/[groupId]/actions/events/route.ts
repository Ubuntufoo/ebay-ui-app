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
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let streamEnded = false;
    const abortUpstream = () => {
      if (!upstreamController.signal.aborted) upstreamController.abort();
    };
    const isAbortError = (error: unknown) =>
      error instanceof Error && error.name === "AbortError";
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        reader = upstream.getReader();
        const onAbort = () => abortUpstream();
        const cleanup = () => request.signal.removeEventListener("abort", onAbort);
        const closeNormally = () => {
          if (streamEnded) return;
          streamEnded = true;
          cleanup();
          try {
            streamController.close();
          } catch {
            // Downstream cancellation may have already closed the stream.
          }
        };
        request.signal.addEventListener("abort", onAbort, {once: true});
        const pump = async (): Promise<void> => {
          try {
            while (!streamEnded) {
              const {done, value} = await reader!.read();
              if (done) {
                closeNormally();
                return;
              }
              if (value) streamController.enqueue(value);
            }
          } catch (error) {
            if (
              request.signal.aborted ||
              upstreamController.signal.aborted ||
              isAbortError(error)
            ) {
              closeNormally();
              return;
            }
            streamEnded = true;
            cleanup();
            streamController.error(error);
          }
        };
        void pump();
      },
      async cancel() {
        if (streamEnded) return;
        streamEnded = true;
        abortUpstream();
        try {
          await reader?.cancel();
        } catch {
          // Reader cancellation after an upstream abort is expected.
        }
      },
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
