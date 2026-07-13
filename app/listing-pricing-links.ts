import type {Listing} from "@/lib/sidecar-api";
import type {Json} from "@/lib/sidecar-api/types";

export interface PricingLink {
  href: string;
  label: string;
}

const keyAliases = {
  brand: ["brand", "manufacturer", "publisher", "make"],
  cardName: ["card", "card name", "card title", "name", "subject"],
  cardNumber: ["card number", "card no", "card #", "#", "number"],
  player: ["player", "athlete", "character"],
  series: ["series"],
  sport: ["sport"],
  set: ["set"],
  year: ["year"],
} as const;

const sportsCardsProSportMap = {
  baseball: "baseball-cards",
  basketball: "basketball-cards",
  football: "football-cards",
  hockey: "hockey-cards",
} as const;

function isRecord(
  value: Json | undefined,
): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toDisplayCase(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b[a-z0-9][a-z0-9']*\b/g, (word) => {
      if (/^\d/.test(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    });
}

function readPrimitiveText(value: Json | undefined): string | null {
  if (typeof value === "string") {
    const normalized = normalizeWhitespace(value);
    return normalized === "" ? null : normalized;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  return null;
}

function readSpecificValue(
  itemSpecifics: Json,
  aliases: readonly string[],
): string | null {
  if (!isRecord(itemSpecifics)) {
    return null;
  }

  for (const [key, value] of Object.entries(itemSpecifics)) {
    if (!aliases.includes(normalizeKey(key))) {
      continue;
    }

    const text = readPrimitiveText(value);
    if (text) {
      return toDisplayCase(text);
    }
  }

  return null;
}

function collectFallbackTerms(value: Json): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  const visit = (entry: Json | undefined): void => {
    const text = readPrimitiveText(entry);
    if (text) {
      const normalized = toDisplayCase(text);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        terms.push(normalized);
      }
    }

    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }

    if (isRecord(entry)) {
      Object.values(entry).forEach(visit);
    }
  };

  visit(value);
  return terms;
}

function joinUnique(parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const part of parts) {
    const normalized =
      typeof part === "string" ? normalizeWhitespace(part) : "";
    if (normalized === "" || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    values.push(normalized);
  }

  return values.join(" ");
}

function buildStructuredCardQuery(listing: Listing): string | null {
  const year = readSpecificValue(listing.item_specifics, keyAliases.year);
  const brand = readSpecificValue(listing.item_specifics, keyAliases.brand);
  const set = readSpecificValue(listing.item_specifics, keyAliases.set);
  const series = readSpecificValue(listing.item_specifics, keyAliases.series);
  const player = readSpecificValue(listing.item_specifics, keyAliases.player);
  const cardName = readSpecificValue(
    listing.item_specifics,
    keyAliases.cardName,
  );
  const cardNumber = readSpecificValue(
    listing.item_specifics,
    keyAliases.cardNumber,
  );

  const leftSide = joinUnique([year, brand, set, series]);
  const rightSide = joinUnique([player, cardName]);

  if (leftSide && rightSide) {
    const suffix = cardNumber ? ` ${cardNumber}` : "";
    return `${leftSide}: ${rightSide}${suffix}`.trim();
  }

  const combined = joinUnique([
    leftSide,
    rightSide,
    cardNumber,
    listing.title ? toDisplayCase(listing.title) : null,
  ]);

  return combined === "" ? null : combined;
}

function readSportsCardsProSportSlug(listing: Listing): string | null {
  const sport = readSpecificValue(listing.item_specifics, keyAliases.sport);
  if (!sport) {
    return null;
  }

  const normalized = normalizeWhitespace(sport).toLowerCase();
  return sportsCardsProSportMap[normalized as keyof typeof sportsCardsProSportMap] ?? null;
}

function buildSportsCardsProUrl(query: string, sport: string | null): string {
  const params = new URLSearchParams({
    q: query,
    type: "prices",
  });

  if (sport) {
    params.append("sport", sport);
  }

  return `https://www.sportscardspro.com/search-products?${params.toString()}`;
}

function buildTerapeakUrl(query: string, now = Date.now()): string {
  const dayRange = 365;
  const endDate = now;
  const startDate = endDate - dayRange * 24 * 60 * 60 * 1000;
  const params = new URLSearchParams();

  params.append("marketplace", "EBAY-US");
  params.append(
    "keywords",
    `${query} -psa -bgs -sgc -cgc -signature -sig -autograph -autographed -graded -lot`,
  );
  params.append("dayRange", String(dayRange));
  params.append("endDate", String(endDate));
  params.append("startDate", String(startDate));
  params.append("categoryId", "0");
  params.append("format", "BEST_OFFER");
  params.append("format", "FIXED_PRICE");
  params.append("offset", "0");
  params.append("limit", "50");
  params.append("tabName", "SOLD");
  params.append("tz", "America/New_York");

  return `https://www.ebay.com/sh/research?${params.toString()}`;
}

function buildTerapeakSearchText(listing: Listing): string | null {
  const title = listing.title ? normalizeWhitespace(listing.title) : "";

  if (title !== "") {
    return title;
  }

  return buildListingPricingSearchText(listing);
}

export function buildListingPricingSearchText(listing: Listing): string | null {
  const title = listing.title ? normalizeWhitespace(listing.title) : "";
  if (title !== "") {
    return title;
  }

  const structured = buildStructuredCardQuery(listing);
  if (structured) {
    return normalizeWhitespace(structured);
  }

  const fallback = joinUnique([
    ...collectFallbackTerms(listing.item_specifics).slice(0, 6),
  ]);

  return fallback === "" ? null : normalizeWhitespace(fallback);
}

export function getListingPricingLinks(
  listing: Listing,
  now = Date.now(),
): PricingLink[] {
  const query = buildListingPricingSearchText(listing);
  const sport = readSportsCardsProSportSlug(listing);
  const terapeakQuery = buildTerapeakSearchText(listing);

  if (!query && !terapeakQuery) {
    return [];
  }

  return [
    ...(query
      ? [
          {
            label: "SportsCardsPro",
            href: buildSportsCardsProUrl(query, sport),
          },
        ]
      : []),
    ...(terapeakQuery
      ? [
          {
            label: "eBay Terapeak",
            href: buildTerapeakUrl(terapeakQuery, now),
          },
        ]
      : []),
  ];
}
