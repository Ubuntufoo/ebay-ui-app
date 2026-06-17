import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const getSidecarConfigMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.fn();

vi.mock("@/lib/config/sidecar", () => ({
  getSidecarConfig: getSidecarConfigMock,
}));

import {
  updateAppSettings,
  updatePricingServiceEnabled,
} from "@/lib/sidecar-api/client";

describe("sidecar app settings updates", () => {
  beforeEach(() => {
    getSidecarConfigMock.mockReset();
    fetchMock.mockReset();
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
          capture_mode: null,
          default_fulfillment_policy_id: null,
          default_package_type: null,
          default_payment_policy_id: null,
          default_return_policy_id: null,
          default_shipping_profile: null,
          ebay_marketplace_id: null,
          gemini_daily_limit: null,
          handling_days: null,
          id: "settings-id",
          incoming_folder_path: null,
          max_order_syncs_per_day: null,
          merchant_location_key: null,
          office_location_name: null,
          pricing_provider_mode: "off",
          pricing_service_enabled: false,
          processed_folder_path: null,
          r2_retention_days_after_sold: null,
          soldcomps_usage: null,
          updated_at: "2026-06-17T00:00:00.000Z",
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

  it("patches pricing provider mode with camelCase payload", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          capture_mode: "single_2_image",
          default_fulfillment_policy_id: null,
          default_package_type: null,
          default_payment_policy_id: null,
          default_return_policy_id: null,
          default_shipping_profile: null,
          ebay_marketplace_id: null,
          gemini_daily_limit: null,
          handling_days: null,
          id: "settings-id",
          incoming_folder_path: null,
          max_order_syncs_per_day: null,
          merchant_location_key: null,
          office_location_name: null,
          pricing_provider_mode: "apify",
          pricing_service_enabled: true,
          processed_folder_path: null,
          r2_retention_days_after_sold: null,
          soldcomps_usage: null,
          updated_at: "2026-06-17T00:00:00.000Z",
        }),
        {
          headers: {"content-type": "application/json"},
          status: 200,
        },
      ),
    );

    const result = await updateAppSettings({pricingProviderMode: "apify"});

    expect(fetchMock).toHaveBeenCalledWith(
      "http://sidecar.example/api/app-settings",
      expect.objectContaining({
        body: JSON.stringify({pricingProviderMode: "apify"}),
        cache: "no-store",
        method: "PATCH",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result.pricing_provider_mode).toBe("apify");
  });
});
