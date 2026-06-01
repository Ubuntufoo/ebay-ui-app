import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const {getEbayEnvironmentMock} = vi.hoisted(() => ({
  getEbayEnvironmentMock: vi.fn(),
}));
const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@/lib/sidecar-api", () => ({
  SidecarApiError: class SidecarApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "SidecarApiError";
      this.status = status;
    }
  },
  getEbayEnvironment: getEbayEnvironmentMock,
}));

import {GET} from "@/app/api/ebay-environment/route";

describe("GET /api/ebay-environment", () => {
  beforeEach(() => {
    getEbayEnvironmentMock.mockReset();
    consoleErrorMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns backend eBay environment payload", async () => {
    getEbayEnvironmentMock.mockResolvedValue({
      api_base_url: "https://api.sandbox.ebay.com",
      environment: "sandbox",
      marketplace_id: "EBAY_US",
      oauth_base_url: "https://auth.sandbox.ebay.com",
    });

    const response = await GET();
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      api_base_url: "https://api.sandbox.ebay.com",
      environment: "sandbox",
      marketplace_id: "EBAY_US",
      oauth_base_url: "https://auth.sandbox.ebay.com",
    });
  });

  it("returns generic error for unexpected failures", async () => {
    getEbayEnvironmentMock.mockRejectedValue(new Error("network failed"));

    const response = await GET();
    const payload = (await response.json()) as {error: string};

    expect(response.status).toBe(500);
    expect(payload.error).toBe("An unexpected error occurred while loading the eBay environment.");
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
  });
});
