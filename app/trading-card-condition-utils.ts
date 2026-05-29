import type {Json, Listing} from "@/lib/sidecar-api/types";

export const tradingCardCategoryIds = ["183050", "183454", "261328"] as const;

export const tradingCardConditionLabels = {
  MT: "Gem Mint",
  MINT: "Mint",
  "NM-MT": "Near Mint-Mint",
  NM: "Near Mint",
  "EX-MT": "Excellent-Mint",
  EX: "Excellent",
  "VG-EX": "Very Good-Excellent",
  VG: "Very Good",
  GOOD: "Good",
  FR: "Fair",
  PR: "Poor",
} as const;

export type TradingCardConditionToken = keyof typeof tradingCardConditionLabels;

export const tradingCardConditionOptions = (
  Object.entries(tradingCardConditionLabels) as Array<
    [TradingCardConditionToken, (typeof tradingCardConditionLabels)[TradingCardConditionToken]]
  >
).map(([token, label]) => ({
  label: `${token} — ${label}`,
  value: token,
}));

function isPlainObjectJson(
  value: Json | null,
): value is Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function getCardConditionTokenFromItemSpecifics(
  itemSpecifics: Json | null,
): string | null {
  if (!isPlainObjectJson(itemSpecifics)) {
    return null;
  }

  const token = itemSpecifics["Card Condition"];

  return typeof token === "string" && token.trim() !== ""
    ? token.trim()
    : null;
}

export function isSupportedTradingCardConditionToken(
  token: string | null,
): token is TradingCardConditionToken {
  return token !== null && token in tradingCardConditionLabels;
}

export function updateItemSpecificsTradingCardCondition(
  itemSpecifics: Json | null,
  token: string | null,
): Json | null {
  if (itemSpecifics === null) {
    return token === null ? null : {"Card Condition": token};
  }

  if (!isPlainObjectJson(itemSpecifics)) {
    return null;
  }

  const nextItemSpecifics = {...itemSpecifics};

  if (token === null) {
    delete nextItemSpecifics["Card Condition"];
  } else {
    nextItemSpecifics["Card Condition"] = token;
  }

  return nextItemSpecifics;
}

export function getTradingCardConditionApprovalMessage(
  listing: Pick<Listing, "category_id" | "condition_id">,
  cardConditionToken: string | null,
): string | null {
  if (
    listing.category_id === null ||
    !tradingCardCategoryIds.includes(
      listing.category_id as (typeof tradingCardCategoryIds)[number],
    )
  ) {
    return null;
  }

  if (listing.condition_id === "2750") {
    return "Graded trading-card descriptors are not supported yet. Use raw/ungraded condition for this workflow.";
  }

  if (listing.condition_id === "4000" && !isSupportedTradingCardConditionToken(cardConditionToken)) {
    return "Trading-card listings require a supported Card Condition before export.";
  }

  return null;
}
