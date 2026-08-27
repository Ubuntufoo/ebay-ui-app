import type {Json} from "@/lib/sidecar-api/types";

export type SportsCardSpecificStatus = "Required / recommended" | "Recommended" | "Optional";
export type SportsCardSpecificCardinality = "single" | "multi";

export interface SportsCardSpecificField {
  label: string;
  persistKey: string;
  aliases: readonly string[];
  status: SportsCardSpecificStatus;
  cardinality: SportsCardSpecificCardinality;
  options?: readonly string[];
  suggestions?: readonly string[];
  manualOnly?: boolean;
}

export const SPORTS_CARD_TAXONOMY_SUGGESTIONS = {
  Material: ["Aluminum", "Card Stock", "Metal", "Paper", "Paperboard", "Plastic"],
  "Card Thickness": [
    "20 Pt.",
    "35 Pt.",
    "55 Pt.",
    "59 Pt.",
    "75 Pt.",
    "79 Pt.",
    "100 Pt.",
    "108 Pt.",
    "130 Pt.",
    "138 Pt.",
    "180 Pt.",
    "197 Pt.",
    "240 Pt.",
    "360 Pt",
  ],
  "Card Size": [
    "Booklet",
    "Bowman",
    "Japanese",
    "Oversized",
    "Standard",
    "Tall",
    "Tobacco",
    "Widevision",
  ],
} as const;

export const SPORTS_CARD_SPECIFIC_DEFAULTS = {
  Material: "Card Stock",
  "Card Thickness": "20 Pt.",
  "Card Size": "Standard",
  Language: "English",
  "Original/Licensed Reprint": "Original",
  Vintage: "Yes",
  Autographed: "No",
} as const;

const REMOVED_SPORTS_CARD_SPECIFIC_KEYS = new Set([
  "california prop 65 warning",
  "customized",
]);

export function sanitizeSportsCardItemSpecifics(
  itemSpecifics: Json,
  categoryId: string | null | undefined,
): Json {
  if (categoryId?.trim() !== "261328" || !isJsonObject(itemSpecifics)) {
    return itemSpecifics;
  }

  return Object.fromEntries(
    Object.entries(itemSpecifics).filter(
      ([key]) => !REMOVED_SPORTS_CARD_SPECIFIC_KEYS.has(key.trim().toLowerCase()),
    ),
  ) as Json;
}

export const sportsCardSpecificFields: readonly SportsCardSpecificField[] = [
  {label: "Sport", persistKey: "Sport", aliases: ["Sport"], status: "Required / recommended", cardinality: "multi"},
  {label: "Player/Athlete", persistKey: "Player", aliases: ["Player/Athlete", "Player", "Athlete"], status: "Recommended", cardinality: "multi"},
  {label: "Manufacturer", persistKey: "Manufacturer", aliases: ["Manufacturer"], status: "Recommended", cardinality: "single"},
  {label: "Season", persistKey: "Season", aliases: ["Season"], status: "Recommended", cardinality: "single"},
  {label: "Parallel/Variety", persistKey: "Parallel/Variety", aliases: ["Parallel/Variety"], status: "Recommended", cardinality: "single"},
  {label: "Features", persistKey: "Features", aliases: ["Features"], status: "Recommended", cardinality: "multi"},
  {label: "Set", persistKey: "Set", aliases: ["Set"], status: "Recommended", cardinality: "single"},
  {label: "Team", persistKey: "Franchise", aliases: ["Team", "Franchise"], status: "Recommended", cardinality: "multi"},
  {label: "League", persistKey: "League", aliases: ["League"], status: "Recommended", cardinality: "multi"},
  {label: "Card Name", persistKey: "Card Name", aliases: ["Card Name"], status: "Recommended", cardinality: "single"},
  {label: "Card Number", persistKey: "Card Number", aliases: ["Card Number"], status: "Recommended", cardinality: "single"},
  {label: "Type", persistKey: "Type", aliases: ["Type"], status: "Recommended", cardinality: "single", options: ["Sports Trading Card"]},
  {label: "Year Manufactured", persistKey: "Year Manufactured", aliases: ["Year Manufactured", "Year"], status: "Optional", cardinality: "single"},
  {label: "Card Size", persistKey: "Card Size", aliases: ["Card Size"], status: "Optional", cardinality: "single", suggestions: SPORTS_CARD_TAXONOMY_SUGGESTIONS["Card Size"]},
  {label: "Country of Origin", persistKey: "Country of Origin", aliases: ["Country of Origin"], status: "Optional", cardinality: "single"},
  {label: "Material", persistKey: "Material", aliases: ["Material"], status: "Optional", cardinality: "multi", suggestions: SPORTS_CARD_TAXONOMY_SUGGESTIONS.Material},
  {label: "Event/Tournament", persistKey: "Event/Tournament", aliases: ["Event/Tournament"], status: "Optional", cardinality: "single"},
  {label: "Autograph Format", persistKey: "Autograph Format", aliases: ["Autograph Format"], status: "Optional", cardinality: "single", options: ["Cut", "Hard Signed", "Label or Sticker"], manualOnly: true},
  {label: "Vintage", persistKey: "Vintage", aliases: ["Vintage"], status: "Optional", cardinality: "single", options: ["Yes", "No"]},
  {label: "Language", persistKey: "Language", aliases: ["Language"], status: "Optional", cardinality: "single"},
  {label: "Original/Licensed Reprint", persistKey: "Original/Licensed Reprint", aliases: ["Original/Licensed Reprint"], status: "Optional", cardinality: "single", options: ["Licensed Reprint", "Original"]},
  {label: "Autograph Authentication Number", persistKey: "Autograph Authentication Number", aliases: ["Autograph Authentication Number"], status: "Optional", cardinality: "single", manualOnly: true},
  {label: "Card Thickness", persistKey: "Card Thickness", aliases: ["Card Thickness"], status: "Optional", cardinality: "single", suggestions: SPORTS_CARD_TAXONOMY_SUGGESTIONS["Card Thickness"]},
  {label: "Insert Set", persistKey: "Insert Set", aliases: ["Insert Set"], status: "Optional", cardinality: "single"},
  {label: "Print Run", persistKey: "Print Run", aliases: ["Print Run"], status: "Optional", cardinality: "single"},
  {label: "Autographed", persistKey: "Autographed", aliases: ["Autographed"], status: "Recommended", cardinality: "single", options: ["Yes", "No"], manualOnly: true},
  {label: "Signed By", persistKey: "Signed By", aliases: ["Signed By"], status: "Optional", cardinality: "multi", manualOnly: true},
  {label: "Autograph Authentication", persistKey: "Autograph Authentication", aliases: ["Autograph Authentication"], status: "Optional", cardinality: "single", manualOnly: true},
] as const;

function isJsonObject(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string | number => typeof entry === "string" || typeof entry === "number")
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(", ");
  }

  return "";
}

export function getSportsCardSpecificDisplayValue(
  itemSpecifics: unknown,
  field: SportsCardSpecificField,
): string {
  if (!isJsonObject(itemSpecifics)) {
    return "";
  }

  for (const alias of field.aliases) {
    const value = normalizeText(itemSpecifics[alias]);
    if (value !== "") {
      return value;
    }
  }

  return "";
}

function parseMultiValue(value: string): string[] {
  return [...new Set(value
    .split(/[\n,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean))];
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim() !== "";
  }

  return Array.isArray(value) && value.some((entry) => typeof entry === "string" && entry.trim() !== "");
}

function hasValidSelectionValue(
  value: unknown,
  field: SportsCardSpecificField,
): boolean {
  if (!field.options) {
    return false;
  }

  const values =
    typeof value === "string"
      ? [value.trim()]
      : Array.isArray(value)
        ? value.every((entry): entry is string => typeof entry === "string")
          ? value.map((entry) => entry.trim())
          : []
        : [];
  if (
    values.length === 0 ||
    (field.cardinality === "single" && values.length !== 1)
  ) {
    return false;
  }

  return values.every((valueEntry) => field.options!.includes(valueEntry));
}

export function hasValidSportsCardSpecificValue(
  itemSpecifics: unknown,
  field: SportsCardSpecificField,
): boolean {
  if (!isJsonObject(itemSpecifics)) {
    return false;
  }

  for (const alias of field.aliases) {
    const value = itemSpecifics[alias];
    if (field.options) {
      if (hasValidSelectionValue(value, field)) {
        return true;
      }
      continue;
    }

    if (hasMeaningfulValue(value)) {
      return true;
    }
  }

  return false;
}

function readAuthorizedYear(itemSpecifics: unknown): string | null {
  if (!isJsonObject(itemSpecifics)) {
    return null;
  }

  const year = itemSpecifics.Year;
  const metadata = itemSpecifics.__draft_metadata;
  if (
    typeof year !== "string" ||
    !/^(?:19\d{2}|20\d{2})$/u.test(year.trim()) ||
    !isJsonObject(metadata) ||
    !isJsonObject(metadata.year)
  ) {
    return null;
  }

  const metadataYear = metadata.year.year;
  const sourceType = metadata.year.source_type;
  const visibleText = metadata.year.visible_text;
  const imageIndex = metadata.year.image_index;
  if (
    typeof metadataYear !== "string" ||
    metadataYear !== year ||
    !/^(?:19\d{2}|20\d{2})$/u.test(metadataYear.trim())
  ) {
    return null;
  }

  if (sourceType === "seller_hint") {
    return visibleText === null && imageIndex === null ? metadataYear.trim() : null;
  }

  if (
    sourceType !== "copyright_line" &&
    sourceType !== "manufacture_line" &&
    sourceType !== "production_line" &&
    sourceType !== "explicit_release_year"
  ) {
    return null;
  }

  return typeof visibleText === "string" &&
    visibleText.trim() !== "" &&
    new RegExp(`\\b${metadataYear.trim()}\\b`, "u").test(visibleText) &&
    typeof imageIndex === "number" &&
    Number.isInteger(imageIndex) &&
    imageIndex >= 0
    ? metadataYear.trim()
    : null;
}

function getDefaultVintageValue(itemSpecifics: unknown, now: () => Date): string {
  const authorizedYear = readAuthorizedYear(itemSpecifics);
  if (!authorizedYear) {
    return SPORTS_CARD_SPECIFIC_DEFAULTS.Vintage;
  }

  return now().getUTCFullYear() - Number(authorizedYear) > 20 ? "Yes" : "No";
}

export function getSportsCardSpecificDefaultChanges(
  itemSpecifics: unknown,
  now: () => Date = () => new Date(),
): Record<string, string> {
  const defaults: Record<string, string> = {};
  const source = isJsonObject(itemSpecifics) ? itemSpecifics : {};

  for (const [persistKey, defaultValue] of Object.entries(SPORTS_CARD_SPECIFIC_DEFAULTS)) {
    const field = sportsCardSpecificFields.find((candidate) => candidate.persistKey === persistKey);
    if (persistKey === "Vintage") {
      if (!field || !hasValidSportsCardSpecificValue(source, field)) {
        defaults[persistKey] = getDefaultVintageValue(source, now);
      }
    } else if (field && !hasValidSportsCardSpecificValue(source, field)) {
      defaults[persistKey] = defaultValue;
    }
  }

  return defaults;
}

export function applySportsCardSpecificDefaults(
  itemSpecifics: unknown,
  now: () => Date = () => new Date(),
): Json {
  let next: Json = isJsonObject(itemSpecifics) ? {...itemSpecifics} : {};
  const defaults = getSportsCardSpecificDefaultChanges(next, now);
  for (const [persistKey, value] of Object.entries(defaults)) {
    const field = sportsCardSpecificFields.find((candidate) => candidate.persistKey === persistKey);
    if (field) {
      next = updateSportsCardSpecific(next, field, value);
    }
  }

  return next;
}

export function updateSportsCardSpecific(
  itemSpecifics: unknown,
  field: SportsCardSpecificField,
  rawValue: string,
): Json {
  const next: Record<string, Json> = isJsonObject(itemSpecifics) ? {...itemSpecifics} : {};

  for (const alias of field.aliases) {
    if (alias !== "Year") {
      delete next[alias];
    }
  }

  const trimmed = rawValue.trim();
  if (trimmed === "") {
    return next;
  }

  if (field.cardinality === "multi") {
    const values = parseMultiValue(trimmed);
    if (values.length > 0) {
      next[field.persistKey] = values.length === 1 ? values[0] : values;
    }
    return next;
  }

  next[field.persistKey] = trimmed;
  return next;
}
