import {describe, expect, it} from "vitest";

import {dynamic} from "@/app/page";

describe("page module", () => {
  it("keeps the listings page force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
