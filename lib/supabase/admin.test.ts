import {beforeEach, describe, expect, it, vi} from "vitest";

import type {Listing} from "@/lib/sidecar-api/types";
import {enqueueGenerateAiJob} from "@/lib/supabase/admin";

const selectMock = vi.fn();
const eqMock = vi.fn();
const maybeSingleMock = vi.fn();
const insertMock = vi.fn();
const singleMock = vi.fn();
const fromMock = vi.fn();
const activeSelectMock = vi.fn();
const activeEqListingMock = vi.fn();
const activeEqJobTypeMock = vi.fn();
const activeInMock = vi.fn();
const activeOrderMock = vi.fn();
const activeLimitMock = vi.fn();
const activeMaybeSingleMock = vi.fn();
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
    activeSelectMock.mockReset();
    activeEqListingMock.mockReset();
    activeEqJobTypeMock.mockReset();
    activeInMock.mockReset();
    activeOrderMock.mockReset();
    activeLimitMock.mockReset();
    activeMaybeSingleMock.mockReset();
    createClientMock.mockReset();
  });

  function buildClient({
    listing,
    insertError = null,
    activeJob = null,
  }: {
    insertError?: {code?: string; message: string} | null;
    listing: ListingStatusRow | null;
    activeJob?: {id: string} | null;
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

    activeMaybeSingleMock.mockResolvedValueOnce({
      data: activeJob,
      error: null,
    });

    activeLimitMock.mockReturnValueOnce({
      maybeSingle: activeMaybeSingleMock,
    });

    activeOrderMock.mockReturnValueOnce({
      limit: activeLimitMock,
    });

    activeInMock.mockReturnValueOnce({
      order: activeOrderMock,
    });

    activeEqJobTypeMock.mockReturnValueOnce({
      in: activeInMock,
    });

    activeEqListingMock.mockReturnValueOnce({
      eq: activeEqJobTypeMock,
    });

    activeSelectMock.mockReturnValueOnce({
      eq: activeEqListingMock,
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
          select: activeSelectMock,
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

  it("returns alreadyQueued when duplicate insert hits DB protection", async () => {
    buildClient({
      listing: {
        listing_id: "LIST-001",
        status: "assets_ready",
      },
      insertError: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
      activeJob: {id: "job-123"},
    });

    const result = await enqueueGenerateAiJob("LIST-001", buildEnv());

    expect(result).toEqual({
      alreadyQueued: true,
    });
  });

  it("surfaces unique-violation failures when no active job exists", async () => {
    buildClient({
      listing: {
        listing_id: "LIST-001",
        status: "assets_ready",
      },
      insertError: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
      activeJob: null,
    });

    await expect(
      enqueueGenerateAiJob("LIST-001", buildEnv()),
    ).rejects.toThrow("duplicate key value violates unique constraint");
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
