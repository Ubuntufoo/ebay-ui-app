import {describe, expect, it} from "vitest";

import {getListingsRealtimePublicKey} from "@/lib/supabase/public-key";

describe("getListingsRealtimePublicKey", () => {
  it("prefers publishable key when present", () => {
    expect(
      getListingsRealtimePublicKey({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        SUPABASE_ANON_KEY: "anon-key",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("publishable-key");
  });

  it("falls back to anon key for older envs", () => {
    expect(
      getListingsRealtimePublicKey({
        SUPABASE_ANON_KEY: "anon-key",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe("anon-key");
  });

  it("returns null without browser-safe key", () => {
    expect(getListingsRealtimePublicKey({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});
