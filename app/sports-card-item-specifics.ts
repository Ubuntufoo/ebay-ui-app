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
  manualOnly?: boolean;
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
  {label: "Autographed", persistKey: "Autographed", aliases: ["Autographed"], status: "Recommended", cardinality: "single", options: ["Yes", "No"], manualOnly: true},
  {label: "Card Name", persistKey: "Card Name", aliases: ["Card Name"], status: "Recommended", cardinality: "single"},
  {label: "Card Number", persistKey: "Card Number", aliases: ["Card Number"], status: "Recommended", cardinality: "single"},
  {label: "Type", persistKey: "Type", aliases: ["Type"], status: "Recommended", cardinality: "single", options: ["Sports Trading Card"]},
  {label: "Year Manufactured", persistKey: "Year Manufactured", aliases: ["Year Manufactured", "Year"], status: "Optional", cardinality: "single"},
  {label: "Signed By", persistKey: "Signed By", aliases: ["Signed By"], status: "Optional", cardinality: "multi", manualOnly: true},
  {label: "Autograph Authentication", persistKey: "Autograph Authentication", aliases: ["Autograph Authentication"], status: "Optional", cardinality: "single", manualOnly: true},
  {label: "Card Size", persistKey: "Card Size", aliases: ["Card Size"], status: "Optional", cardinality: "single"},
  {label: "Country of Origin", persistKey: "Country of Origin", aliases: ["Country of Origin"], status: "Optional", cardinality: "single"},
  {label: "Material", persistKey: "Material", aliases: ["Material"], status: "Optional", cardinality: "multi"},
  {label: "Event/Tournament", persistKey: "Event/Tournament", aliases: ["Event/Tournament"], status: "Optional", cardinality: "single"},
  {label: "Autograph Format", persistKey: "Autograph Format", aliases: ["Autograph Format"], status: "Optional", cardinality: "single", options: ["Cut", "Hard Signed", "Label or Sticker"], manualOnly: true},
  {label: "Vintage", persistKey: "Vintage", aliases: ["Vintage"], status: "Optional", cardinality: "single", options: ["Yes", "No"]},
  {label: "Language", persistKey: "Language", aliases: ["Language"], status: "Optional", cardinality: "single"},
  {label: "Original/Licensed Reprint", persistKey: "Original/Licensed Reprint", aliases: ["Original/Licensed Reprint"], status: "Optional", cardinality: "single", options: ["Original", "Licensed Reprint"]},
  {label: "Autograph Authentication Number", persistKey: "Autograph Authentication Number", aliases: ["Autograph Authentication Number"], status: "Optional", cardinality: "single", manualOnly: true},
  {label: "California Prop 65 Warning", persistKey: "California Prop 65 Warning", aliases: ["California Prop 65 Warning"], status: "Optional", cardinality: "single"},
  {label: "Card Thickness", persistKey: "Card Thickness", aliases: ["Card Thickness"], status: "Optional", cardinality: "single"},
  {label: "Customized", persistKey: "Customized", aliases: ["Customized"], status: "Optional", cardinality: "single", options: ["No", "Yes"]},
  {label: "Insert Set", persistKey: "Insert Set", aliases: ["Insert Set"], status: "Optional", cardinality: "single"},
  {label: "Print Run", persistKey: "Print Run", aliases: ["Print Run"], status: "Optional", cardinality: "single"},
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
