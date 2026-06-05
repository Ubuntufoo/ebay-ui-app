"use client";

import type {Listing} from "@/lib/sidecar-api";
import type {Json} from "@/lib/sidecar-api/types";

export const structuredSkuPrefixes = ["BSKBL", "BSBL", "OTHER"] as const;

export type StructuredSkuPrefix = (typeof structuredSkuPrefixes)[number];

export const structuredSkuPrefixLabels: Record<StructuredSkuPrefix, string> = {
  BSKBL: "Basketball",
  BSBL: "Baseball",
  OTHER: "Other / uncertain",
};

const BASE_LISTING_ID_PATTERN = /^(Single|Lot)-\d+$/;

function isRecord(
  value: Json | undefined,
): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStructuredSkuPrefix(
  value: unknown,
): value is StructuredSkuPrefix {
  return (
    typeof value === "string" &&
    structuredSkuPrefixes.includes(value as StructuredSkuPrefix)
  );
}

export function getStructuredSkuPrefixFromItemSpecifics(
  itemSpecifics: Listing["item_specifics"],
): StructuredSkuPrefix {
  if (!isRecord(itemSpecifics)) {
    return "OTHER";
  }

  const candidate = itemSpecifics.skuCategoryCode;
  return isStructuredSkuPrefix(candidate) ? candidate : "OTHER";
}

export function setStructuredSkuPrefixInItemSpecifics(
  itemSpecifics: Listing["item_specifics"],
  prefix: StructuredSkuPrefix,
): Json {
  if (isRecord(itemSpecifics)) {
    return {
      ...itemSpecifics,
      skuCategoryCode: prefix,
    };
  }

  return {
    skuCategoryCode: prefix,
  };
}

export function buildStructuredSkuPreview(
  listingId: string,
  prefix: StructuredSkuPrefix,
): string | null {
  if (!BASE_LISTING_ID_PATTERN.test(listingId)) {
    return null;
  }

  return `${prefix}-${listingId}`;
}
