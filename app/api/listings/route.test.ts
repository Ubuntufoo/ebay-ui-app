import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const {listListingsMock} = vi.hoisted(() => ({
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
    listListings: listListingsMock,
  };
});

import {GET} from "@/app/api/listings/route";

describe("GET /api/listings", () => {
  beforeEach(() => {
    listListingsMock.mockReset();
    consoleErrorMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
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
