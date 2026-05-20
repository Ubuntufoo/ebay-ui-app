import {beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api/types";
import {enqueueGenerateAiJob} from "@/lib/supabase/admin";

const selectMock = vi.fn();
const eqMock = vi.fn();
const maybeSingleMock = vi.fn();
const insertMock = vi.fn();
const singleMock = vi.fn();
const fromMock = vi.fn();
const createClientMock = vi.hoisted(() => vi.fn());
type ListingStatusRow = Pick<Listing, "listing_id" | "status">;

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

describe("enqueueGenerateAiJob", () => {
  beforeEach(() => {
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    insertMock.mockReset();
    singleMock.mockReset();
    fromMock.mockReset();
    createClientMock.mockReset();
  });

  function buildClient({
    listing,
    insertError = null,
  }: {
    insertError?: Error | null;
    listing: ListingStatusRow | null;
  }) {
    maybeSingleMock.mockResolvedValueOnce({
      data: listing,
      error: null,
    });

    singleMock.mockResolvedValueOnce({
      data: {id: "job-123"},
      error: insertError,
    });

    eqMock.mockReturnValueOnce({
      maybeSingle: maybeSingleMock,
    });

    selectMock.mockReturnValueOnce({
      eq: eqMock,
    });

    insertMock.mockReturnValueOnce({
      select: vi.fn(() => ({
        single: singleMock,
      })),
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "listings") {
        return {
          select: selectMock,
        };
      }

      if (table === "jobs") {
        return {
          insert: insertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    createClientMock.mockReturnValue({
      from: fromMock,
    });
  }

  function buildEnv(): NodeJS.ProcessEnv {
    return {
      NODE_ENV: "test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      SUPABASE_URL: "https://example.supabase.co",
    } as NodeJS.ProcessEnv;
  }

  it("validates listing and inserts generate_ai job", async () => {
    buildClient({
      listing: {
        listing_id: "LIST-001",
        status: "assets_ready",
      },
    });

    await enqueueGenerateAiJob("LIST-001", {
      ...buildEnv(),
    });

    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
    expect(fromMock).toHaveBeenCalledWith("listings");
    expect(selectMock).toHaveBeenCalledWith("listing_id,status");
    expect(eqMock).toHaveBeenCalledWith("listing_id", "LIST-001");
    expect(fromMock).toHaveBeenCalledWith("jobs");
    expect(insertMock).toHaveBeenCalledWith({
      job_type: "generate_ai",
      listing_id: "LIST-001",
      next_run_at: null,
      status: "queued",
    });
  });

  it("rejects non-assets-ready listings", async () => {
    buildClient({
      listing: {
        listing_id: "LIST-001",
        status: "generating",
      },
    });

    await expect(
      enqueueGenerateAiJob("LIST-001", {
        ...buildEnv(),
      }),
    ).rejects.toThrow(
      'Listing "LIST-001" is not eligible for generate_ai from status "generating".',
    );

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects missing listings", async () => {
    buildClient({
      listing: null,
    });

    await expect(
      enqueueGenerateAiJob("LIST-001", {
        ...buildEnv(),
      }),
    ).rejects.toThrow('Listing "LIST-001" was not found.');

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("surfaces insert failures", async () => {
    buildClient({
      listing: {
        listing_id: "LIST-001",
        status: "assets_ready",
      },
      insertError: new Error("insert failed"),
    });

    await expect(
      enqueueGenerateAiJob("LIST-001", {
        ...buildEnv(),
      }),
    ).rejects.toThrow("insert failed");
  });
});
