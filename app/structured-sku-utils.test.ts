import {describe, expect, it} from "vitest";

import {buildStructuredSkuPreview} from "@/app/structured-sku-utils";

describe("buildStructuredSkuPreview", () => {
  it("builds preview for valid Single listing IDs", () => {
    expect(buildStructuredSkuPreview("Single-000001", "BSKBL")).toBe(
      "BSKBL-Single-000001",
    );
  });

  it("builds preview for valid Lot listing IDs", () => {
    expect(buildStructuredSkuPreview("Lot-000002", "BSBL")).toBe(
      "BSBL-Lot-000002",
    );
  });

  it("rejects non-six-digit Single listing IDs", () => {
    expect(buildStructuredSkuPreview("Single-1", "BSKBL")).toBeNull();
  });

  it("rejects Single-000000", () => {
    expect(buildStructuredSkuPreview("Single-000000", "BSKBL")).toBeNull();
  });

  it("rejects Lot listing IDs with too many digits", () => {
    expect(buildStructuredSkuPreview("Lot-1234567", "BSBL")).toBeNull();
  });

  it("rejects malformed listing IDs", () => {
    expect(buildStructuredSkuPreview("LIST-001", "OTHER")).toBeNull();
  });
});
