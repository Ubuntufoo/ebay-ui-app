import {beforeEach, describe, expect, it, vi} from "vitest";

const getCreationDefaultsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sidecar-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sidecar-api")>()),
  getVariationListingCreationDefaults: getCreationDefaultsMock,
}));

import {GET} from "@/app/api/variation-listings/creation-defaults/route";
import {SidecarApiError} from "@/lib/sidecar-api";

describe("variation listing creation-defaults route", () => {
  beforeEach(() => {
    getCreationDefaultsMock.mockReset();
  });

  it("returns the Sidecar creation-defaults envelope", async () => {
    const creationDefaults = {
      fulfillmentPolicyId: "fulfillment-1",
      marketplaceId: "EBAY_US",
      merchantLocationKey: "main-location",
      paymentPolicyId: "payment-1",
      returnPolicyId: "return-1",
    };
    getCreationDefaultsMock.mockResolvedValue(creationDefaults);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({creationDefaults});
  });

  it("preserves Sidecar status for creation-defaults failures", async () => {
    getCreationDefaultsMock.mockRejectedValue(
      new SidecarApiError("defaults unavailable", 409),
    );

    const response = await GET();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error: "defaults unavailable"});
  });
});
