import {describe, expect, it} from "vitest";

import {
  getAllowedManualStatusTransitions,
  getListingStatusBadgeClassName,
  getListingStatusLabel,
} from "@/app/listing-status-flow";

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

  it("maps exported listings to their label and badge class", () => {
    expect(getListingStatusLabel("exported")).toBe("Exported");
    expect(getListingStatusBadgeClassName("exported")).not.toBe("");
  });
});
