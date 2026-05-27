import {describe, expect, it} from "vitest";

import {getAllowedManualStatusTransitions} from "@/app/listing-status-flow";

describe("listing status flow", () => {
  it("does not expose a manual generating transition from assets_ready", () => {
    expect(getAllowedManualStatusTransitions("assets_ready")).toEqual([]);
  });

  it("keeps generating recovery transitions available for locked listings", () => {
    expect(getAllowedManualStatusTransitions("generating")).toEqual([
      "assets_ready",
      "needs_review",
    ]);
  });
});
