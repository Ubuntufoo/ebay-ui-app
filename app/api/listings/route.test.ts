import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const {getAppSettingsMock, getGeminiUsageMock, listListingsMock} = vi.hoisted(() => ({
  getAppSettingsMock: vi.fn(),
  getGeminiUsageMock: vi.fn(),
  listListingsMock: vi.fn(),
}));
const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@/lib/sidecar-api", async () => {
  return {
    SidecarApiError: class SidecarApiError extends Error {
      status: number;

      constructor(message: string, status: number) {
        super(message);
        this.name = "SidecarApiError";
        this.status = status;
      }
    },
    getAppSettings: getAppSettingsMock,
    getGeminiUsage: getGeminiUsageMock,
    listListings: listListingsMock,
  };
});

import {GET} from "@/app/api/listings/route";

describe("GET /api/listings", () => {
  beforeEach(() => {
    getAppSettingsMock.mockReset();
    getGeminiUsageMock.mockReset();
    listListingsMock.mockReset();
    consoleErrorMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns listings and Gemini usage when both upstream calls succeed", async () => {
    listListingsMock.mockResolvedValue([{listing_id: "LIST-001"}]);
    getAppSettingsMock.mockResolvedValue({
      soldcomps_usage: {
        limit: 50,
        updatedAt: "2026-06-16T16:30:00.000Z",
        used: 43,
      },
    });
    getGeminiUsageMock.mockResolvedValue({
      effective_limit: 500,
      last_attempt: null,
      remaining: 479,
      reset_at: "2026-06-02T07:00:00.000Z",
      reset_time_zone: "America/Los_Angeles",
      usage_date: "2026-06-01",
      used: 21,
    });

    const response = await GET();
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      geminiUsage: {
        effective_limit: 500,
        last_attempt: null,
        remaining: 479,
        reset_at: "2026-06-02T07:00:00.000Z",
        reset_time_zone: "America/Los_Angeles",
        usage_date: "2026-06-01",
        used: 21,
      },
      geminiUsageStatus: "ready",
      listings: [{listing_id: "LIST-001"}],
      soldCompsUsage: {
        limit: 50,
        updatedAt: "2026-06-16T16:30:00.000Z",
        used: 43,
      },
    });
  });

  it("keeps listings refresh alive when Gemini usage fetch fails", async () => {
    listListingsMock.mockResolvedValue([{listing_id: "LIST-001"}]);
    getAppSettingsMock.mockResolvedValue({
      soldcomps_usage: null,
    });
    getGeminiUsageMock.mockRejectedValue(new Error("usage failed"));

    const response = await GET();
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      geminiUsage: null,
      geminiUsageStatus: "error",
      listings: [{listing_id: "LIST-001"}],
      soldCompsUsage: null,
    });
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
  });

  it("keeps listings refresh alive when SoldComps usage fetch fails", async () => {
    listListingsMock.mockResolvedValue([{listing_id: "LIST-001"}]);
    getGeminiUsageMock.mockResolvedValue({
      effective_limit: 500,
      last_attempt: null,
      remaining: 479,
      reset_at: "2026-06-02T07:00:00.000Z",
      reset_time_zone: "America/Los_Angeles",
      usage_date: "2026-06-01",
      used: 21,
    });
    getAppSettingsMock.mockRejectedValue(new Error("settings failed"));

    const response = await GET();
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      geminiUsage: {
        effective_limit: 500,
        last_attempt: null,
        remaining: 479,
        reset_at: "2026-06-02T07:00:00.000Z",
        reset_time_zone: "America/Los_Angeles",
        usage_date: "2026-06-01",
        used: 21,
      },
      geminiUsageStatus: "ready",
      listings: [{listing_id: "LIST-001"}],
      soldCompsUsage: null,
    });
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
  });

  it("returns generic error for unexpected failures", async () => {
    listListingsMock.mockRejectedValue(new Error("secret upstream url"));

    const response = await GET();
    const payload = (await response.json()) as {error: string};

    expect(response.status).toBe(500);
    expect(payload.error).toBe("An unexpected error occurred while loading listings.");
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
  });
});
