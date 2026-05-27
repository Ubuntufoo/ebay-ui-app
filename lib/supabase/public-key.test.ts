import {describe, expect, it} from "vitest";

import {
  getListingsRealtimePublicKey,
  getListingsRealtimePublicUrl,
} from "@/lib/supabase/public-key";

function buildJwt(payload: object) {
  return [
    "header",
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");
}

describe("getListingsRealtimePublicKey", () => {
  it("prefers publishable key when present", () => {
    expect(
      getListingsRealtimePublicKey({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        SUPABASE_ANON_KEY: "anon-key",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("publishable-key");
  });

  it("uses a NEXT_PUBLIC anon key when present", () => {
    expect(
      getListingsRealtimePublicKey({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("public-anon-key");
  });

  it("falls back to a legacy anon key when its role claim is anon", () => {
    expect(
      getListingsRealtimePublicKey({
        SUPABASE_ANON_KEY: buildJwt({role: "anon"}),
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(buildJwt({role: "anon"}));
  });

  it("rejects a legacy non-anon key", () => {
    expect(
      getListingsRealtimePublicKey({
        SUPABASE_ANON_KEY: buildJwt({role: "service_role"}),
      } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("returns null without browser-safe key", () => {
    expect(getListingsRealtimePublicKey({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("getListingsRealtimePublicUrl", () => {
  it("prefers the NEXT_PUBLIC Supabase URL", () => {
    expect(
      getListingsRealtimePublicUrl({
        NEXT_PUBLIC_SUPABASE_URL: "https://public.example.supabase.co",
        SUPABASE_URL: "https://legacy.example.supabase.co",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("https://public.example.supabase.co");
  });

  it("falls back to the legacy Supabase URL", () => {
    expect(
      getListingsRealtimePublicUrl({
        SUPABASE_URL: "https://legacy.example.supabase.co",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("https://legacy.example.supabase.co");
  });
});
