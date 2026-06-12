import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {updatePricingServiceEnabled} from "@/lib/sidecar-api/client";

const {fetchMock, getSidecarConfigMock} = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getSidecarConfigMock: vi.fn(),
}));

vi.mock("@/lib/config/sidecar", () => ({
  getSidecarConfig: getSidecarConfigMock,
}));

describe("updatePricingServiceEnabled", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getSidecarConfigMock.mockReset();
    getSidecarConfigMock.mockReturnValue({
      apiUrl: "http://sidecar.example",
      bearerToken: "token-123",
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PATCHes app settings with pricingServiceEnabled body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pricing_service_enabled: false,
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    const result = await updatePricingServiceEnabled(false);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/app-settings",
      expect.objectContaining({
        method: "PATCH",
        cache: "no-store",
        body: JSON.stringify({pricingServiceEnabled: false}),
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result.pricing_service_enabled).toBe(false);
  });
});
