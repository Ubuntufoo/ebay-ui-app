import {beforeEach, describe, expect, it, vi} from "vitest";

import {enqueueGenerateListing} from "@/app/listing-generate-actions";

const {enqueueGenerateAiJobMock, revalidatePathMock} = vi.hoisted(() => ({
  enqueueGenerateAiJobMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  enqueueGenerateAiJob: enqueueGenerateAiJobMock,
}));

describe("enqueueGenerateListing", () => {
  beforeEach(() => {
    enqueueGenerateAiJobMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("queues generate_ai for a listing", async () => {
    enqueueGenerateAiJobMock.mockResolvedValueOnce({alreadyQueued: false});
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(enqueueGenerateAiJobMock).toHaveBeenCalledWith("LIST-001");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(result).toEqual({
      error: null,
      info: null,
      success: "Queued generate_ai for LIST-001.",
    });
  });

  it("surfaces already queued as info", async () => {
    enqueueGenerateAiJobMock.mockResolvedValueOnce({alreadyQueued: true});
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result).toEqual({
      error: null,
      info: "Generate already queued or running for LIST-001.",
      success: null,
    });
  });

  it("rejects missing listing id", async () => {
    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      new FormData(),
    );

    expect(enqueueGenerateAiJobMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Listing ID is required.",
      info: null,
      success: null,
    });
  });

  it("surfaces enqueue failures", async () => {
    enqueueGenerateAiJobMock.mockRejectedValueOnce(new Error("queue failed"));
    const formData = new FormData();
    formData.set("listing_id", "LIST-001");

    const result = await enqueueGenerateListing(
      {error: null, info: null, success: null},
      formData,
    );

    expect(result).toEqual({
      error: "queue failed",
      info: null,
      success: null,
    });
  });
});
