import type {Json, Listing} from "@/lib/sidecar-api/types";

export const tradingCardCategoryIds = ["183050", "183454", "261328"] as const;

export const tradingCardConditionLabels = {
  NEAR_MINT_OR_BETTER: "Near mint or better",
  EXCELLENT: "Excellent",
  VERY_GOOD: "Very good",
  POOR: "Poor",
} as const;

export type TradingCardConditionToken = keyof typeof tradingCardConditionLabels;

export const tradingCardConditionOptions = (
  Object.entries(tradingCardConditionLabels) as Array<
    [TradingCardConditionToken, (typeof tradingCardConditionLabels)[TradingCardConditionToken]]
  >
).map(([token, label]) => ({
  label,
  value: token,
}));

const tradingCardConditionLegacyAliases: Record<string, TradingCardConditionToken> = {
  MT: "NEAR_MINT_OR_BETTER",
  MINT: "NEAR_MINT_OR_BETTER",
  "NM-MT": "NEAR_MINT_OR_BETTER",
  NM: "NEAR_MINT_OR_BETTER",
  "NEAR MINT": "NEAR_MINT_OR_BETTER",
  "NEAR MINT-MINT": "NEAR_MINT_OR_BETTER",
  "GEM MINT": "NEAR_MINT_OR_BETTER",
  "NEAR MINT OR BETTER": "NEAR_MINT_OR_BETTER",
  "EX-MT": "EXCELLENT",
  EX: "EXCELLENT",
  "EX - EXCELLENT": "EXCELLENT",
  "EXCELLENT-MINT": "EXCELLENT",
  EXCELLENT: "EXCELLENT",
  "VG-EX": "VERY_GOOD",
  VG: "VERY_GOOD",
  GOOD: "VERY_GOOD",
  "VG - VERY GOOD": "VERY_GOOD",
  "VERY GOOD-EXCELLENT": "VERY_GOOD",
  "VERY GOOD": "VERY_GOOD",
  FR: "POOR",
  PR: "POOR",
  FAIR: "POOR",
  POOR: "POOR",
};

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

export function normalizeTradingCardConditionToken(
  token: string | null,
): TradingCardConditionToken | null {
  if (token === null) {
    return null;
  }

  if (isSupportedTradingCardConditionToken(token)) {
    return token;
  }

  const aliasKey = token.trim().replace(/\s+/g, " ").toUpperCase();
  return tradingCardConditionLegacyAliases[aliasKey] ?? null;
}

export function normalizeItemSpecificsTradingCardCondition(
  itemSpecifics: Json | null,
): Json | null {
  if (!isPlainObjectJson(itemSpecifics)) {
    return itemSpecifics;
  }

  const currentToken = getCardConditionTokenFromItemSpecifics(itemSpecifics);
  const normalizedToken = normalizeTradingCardConditionToken(currentToken);

  if (normalizedToken === null || normalizedToken === currentToken) {
    return itemSpecifics;
  }

  return {
    ...itemSpecifics,
    "Card Condition": normalizedToken,
  };
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

  if (
    listing.condition_id === "4000" &&
    normalizeTradingCardConditionToken(cardConditionToken) === null
  ) {
    return "Trading-card listings require a supported Card Condition before export.";
  }

  return null;
}
