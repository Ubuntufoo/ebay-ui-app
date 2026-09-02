import {beforeEach, describe, expect, it, vi} from "vitest";

const listVariationListingGroupsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sidecar-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sidecar-api")>()),
  listVariationListingGroups: listVariationListingGroupsMock,
}));

import {dynamic} from "@/app/variation-listings/page";
import {GET} from "@/app/api/variation-listings/route";
import {SidecarApiError} from "@/lib/sidecar-api";

describe("variation listings page module", () => {
  beforeEach(() => {
    listVariationListingGroupsMock.mockReset();
  });

  it("keeps the variation workspace force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("proxies variation groups through the server-side Sidecar client", async () => {
    listVariationListingGroupsMock.mockResolvedValue([{groupId: "group-1"}]);

    const response = await GET();

    expect(listVariationListingGroupsMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({groups: [{groupId: "group-1"}]});
  });

  it("preserves Sidecar status codes at the local API seam", async () => {
    listVariationListingGroupsMock.mockRejectedValue(
      new SidecarApiError("Sidecar request failed with 503.", 503),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Sidecar request failed with 503.",
    });
  });
});
