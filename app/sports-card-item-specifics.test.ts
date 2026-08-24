import {describe, expect, it} from "vitest";

import {
  getSportsCardSpecificDisplayValue,
  sportsCardSpecificFields,
  updateSportsCardSpecific,
} from "@/app/sports-card-item-specifics";

describe("sports card item specifics", () => {
  it("exposes populated and unassigned category-261328 fields", () => {
    const labels = sportsCardSpecificFields.map((field) => field.label);

    expect(labels).toContain("Set");
    expect(labels).toContain("Season");
    expect(labels).toContain("Year Manufactured");
    expect(labels).toContain("Player/Athlete");
    expect(labels).toContain("Team");
    expect(labels).toContain("Insert Set");
    expect(labels).toContain("Print Run");
    expect(labels).toContain("Autographed");
    expect(labels).toContain("Autograph Format");
  });

  it("reads internal Player and Franchise aliases using eBay display fields", () => {
    const specifics = {
      Player: "Yao Ming",
      Franchise: "Houston Rockets",
      Set: "Revolution",
    };
    const player = sportsCardSpecificFields.find((field) => field.label === "Player/Athlete")!;
    const team = sportsCardSpecificFields.find((field) => field.label === "Team")!;
    const season = sportsCardSpecificFields.find((field) => field.label === "Season")!;

    expect(getSportsCardSpecificDisplayValue(specifics, player)).toBe("Yao Ming");
    expect(getSportsCardSpecificDisplayValue(specifics, team)).toBe("Houston Rockets");
    expect(getSportsCardSpecificDisplayValue(specifics, season)).toBe("");
  });

  it("merges manual edits without discarding unrelated internal listing metadata", () => {
    const season = sportsCardSpecificFields.find((field) => field.label === "Season")!;
    const language = sportsCardSpecificFields.find((field) => field.label === "Language")!;
    const starting = {
      Set: "Revolution",
      Player: "Yao Ming",
      skuCategoryCode: "BSKBL",
      CategorySuggestion: "Sports Trading Cards",
    };

    const withSeason = updateSportsCardSpecific(starting, season, "2024-25");
    const withLanguage = updateSportsCardSpecific(withSeason, language, "English");

    expect(withLanguage).toMatchObject({
      Set: "Revolution",
      Player: "Yao Ming",
      Season: "2024-25",
      Language: "English",
      skuCategoryCode: "BSKBL",
      CategorySuggestion: "Sports Trading Cards",
    });
  });

  it("stores multi-value fields as clean arrays and clears blank fields", () => {
    const features = sportsCardSpecificFields.find((field) => field.label === "Features")!;
    const populated = updateSportsCardSpecific({}, features, "Insert, Short Print\nParallel/Variety");

    expect(populated).toEqual({
      Features: ["Insert", "Short Print", "Parallel/Variety"],
    });
    expect(updateSportsCardSpecific(populated, features, "")).toEqual({});
  });
});
