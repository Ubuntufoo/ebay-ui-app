import {describe, expect, it, vi} from "vitest";

const getConfig = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/config/sidecar", () => ({getSidecarConfig: getConfig}));
vi.stubGlobal("fetch", fetchMock);
import {GET} from "@/app/api/variation-listings/[groupId]/actions/events/route";

describe("variation action SSE proxy", () => {
  it("streams with server-only authorization headers", async () => {
    getConfig.mockReturnValue({apiUrl: "http://sidecar", bearerToken: "secret"});
    fetchMock.mockResolvedValueOnce(new Response("event: ready\ndata: {}\n\n", {headers: {"content-type": "text/event-stream"}}));
    const response = await GET(new Request("http://local"), {params: Promise.resolve({groupId: "group/1"})});
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(fetchMock).toHaveBeenCalledWith("http://sidecar/api/variation-listings/group%2F1/actions/events", expect.objectContaining({headers: {Accept: "text/event-stream", Authorization: "Bearer secret"}}));
  });
  it("propagates request abort to the upstream signal and body", async () => {
    getConfig.mockReturnValue({apiUrl: "http://sidecar"});
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), {name: "AbortError"}));
    const response = await GET({signal: controller.signal} as Request, {params: Promise.resolve({groupId: "group-1"})});
    expect(response.status).toBe(499);
  });
});
