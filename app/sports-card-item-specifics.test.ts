import {describe, expect, it} from "vitest";

import {
  applySportsCardSpecificDefaults,
  getSportsCardSpecificDisplayValue,
  getSportsCardSpecificDefaultChanges,
  hasValidSportsCardSpecificValue,
  sanitizeSportsCardItemSpecifics,
  SPORTS_CARD_TAXONOMY_SUGGESTIONS,
  sportsCardSpecificFields,
  updateSportsCardSpecific,
} from "@/app/sports-card-item-specifics";

describe("sports card item specifics", () => {
  it("exposes populated and unassigned category-261328 fields", () => {
    const labels = sportsCardSpecificFields.map((field) => field.label);

    expect(labels).toEqual([
      "Sport",
      "Player/Athlete",
      "Manufacturer",
      "Season",
      "Parallel/Variety",
      "Features",
      "Set",
      "Team",
      "League",
      "Card Name",
      "Card Number",
      "Type",
      "Year Manufactured",
      "Card Size",
      "Country of Origin",
      "Material",
      "Event/Tournament",
      "Autograph Format",
      "Vintage",
      "Language",
      "Original/Licensed Reprint",
      "Autograph Authentication Number",
      "Card Thickness",
      "Insert Set",
      "Print Run",
      "Autographed",
      "Signed By",
      "Autograph Authentication",
    ]);

    expect(labels).toContain("Set");
    expect(labels).toContain("Season");
    expect(labels).toContain("Year Manufactured");
    expect(labels).toContain("Player/Athlete");
    expect(labels).toContain("Team");
    expect(labels).toContain("Insert Set");
    expect(labels).toContain("Print Run");
    expect(labels).toContain("Autographed");
    expect(labels).toContain("Autograph Format");
    expect(labels).not.toContain("California Prop 65 Warning");
    expect(labels).not.toContain("Customized");
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

  it("exposes exact free-text taxonomy suggestions and fills only missing defaults", () => {
    expect(SPORTS_CARD_TAXONOMY_SUGGESTIONS.Material).toEqual([
      "Aluminum",
      "Card Stock",
      "Metal",
      "Paper",
      "Paperboard",
      "Plastic",
    ]);
    expect(SPORTS_CARD_TAXONOMY_SUGGESTIONS["Card Thickness"][0]).toBe("20 Pt.");
    expect(SPORTS_CARD_TAXONOMY_SUGGESTIONS["Card Size"]).toContain("Standard");

    const saved = {
      Material: ["Paper"],
      Vintage: "No",
    };
    expect(getSportsCardSpecificDefaultChanges(saved)).toMatchObject({
      "Card Thickness": "20 Pt.",
      "Card Size": "Standard",
      Language: "English",
      "Original/Licensed Reprint": "Original",
      Autographed: "No",
    });
    expect(getSportsCardSpecificDefaultChanges(saved)).not.toHaveProperty("Material");
    expect(getSportsCardSpecificDefaultChanges(saved)).not.toHaveProperty("Vintage");
    expect(applySportsCardSpecificDefaults(saved)).toMatchObject(saved);
  });

  it("derives Vintage from authorized year evidence only when no saved Yes/No exists", () => {
    const trustedYear = {
      Year: "2000",
      __draft_metadata: {
        year: {
          year: "2000",
          source_type: "explicit_release_year",
          visible_text: "Copyright 2000",
          image_index: 0,
        },
      },
    };

    expect(
      getSportsCardSpecificDefaultChanges(trustedYear, () => new Date("2026-01-01T00:00:00.000Z")),
    ).toHaveProperty("Vintage", "Yes");
    expect(
      getSportsCardSpecificDefaultChanges(
        {...trustedYear, Vintage: "No"},
        () => new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).not.toHaveProperty("Vintage");
  });

  it("sanitizes removed specifics only for category 261328", () => {
    const stale = {
      Customized: "No",
      "California Prop 65 Warning": "Cancer and Reproductive Harm",
      Material: "Card Stock",
    };

    expect(sanitizeSportsCardItemSpecifics(stale, "261328")).toEqual({
      Material: "Card Stock",
    });
    expect(sanitizeSportsCardItemSpecifics(stale, "CAT-1")).toEqual(stale);
  });

  it("does not authorize year evidence when canonical Year differs by whitespace", () => {
    const mismatchedYear = {
      Year: " 2020 ",
      __draft_metadata: {
        year: {
          year: "2020",
          source_type: "seller_hint",
          visible_text: null,
          image_index: null,
        },
      },
    };

    expect(
      getSportsCardSpecificDefaultChanges(
        mismatchedYear,
        () => new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).toHaveProperty("Vintage", "Yes");
  });

  it("validates selection-only saved values before preserving or defaulting them", () => {
    const originalField = sportsCardSpecificFields.find(
      (field) => field.persistKey === "Original/Licensed Reprint",
    )!;

    expect(
      getSportsCardSpecificDefaultChanges({
        "Original/Licensed Reprint": "No",
      }),
    ).toHaveProperty("Original/Licensed Reprint", "Original");
    expect(
      getSportsCardSpecificDefaultChanges({
        "Original/Licensed Reprint": ["Licensed Reprint", "Original"],
      }),
    ).toHaveProperty("Original/Licensed Reprint", "Original");
    expect(
      getSportsCardSpecificDefaultChanges({
        "Original/Licensed Reprint": "Licensed Reprint",
      }),
    ).not.toHaveProperty("Original/Licensed Reprint");
    expect(
      hasValidSportsCardSpecificValue(
        {"Original/Licensed Reprint": "Licensed Reprint"},
        originalField,
      ),
    ).toBe(true);
    expect(
      hasValidSportsCardSpecificValue(
        {"Original/Licensed Reprint": ["Licensed Reprint", "Original"]},
        originalField,
      ),
    ).toBe(false);
    expect(
      hasValidSportsCardSpecificValue(
        {"Original/Licensed Reprint": ["Licensed Reprint", 1]},
        originalField,
      ),
    ).toBe(false);

    expect(
      getSportsCardSpecificDisplayValue(
        applySportsCardSpecificDefaults({
          "Original/Licensed Reprint": "No",
        }),
        originalField,
      ),
    ).toBe("Original");
    expect(
      getSportsCardSpecificDisplayValue(
        applySportsCardSpecificDefaults({
          "Original/Licensed Reprint": ["Licensed Reprint", "Original"],
        }),
        originalField,
      ),
    ).toBe("Original");
    expect(
      getSportsCardSpecificDisplayValue(
        applySportsCardSpecificDefaults({
          "Original/Licensed Reprint": "Licensed Reprint",
        }),
        originalField,
      ),
    ).toBe("Licensed Reprint");
  });

  it("defaults Autographed to No while preserving saved Yes or No", () => {
    const autographedField = sportsCardSpecificFields.find(
      (field) => field.persistKey === "Autographed",
    )!;

    expect(getSportsCardSpecificDefaultChanges({})).toHaveProperty(
      "Autographed",
      "No",
    );
    expect(
      getSportsCardSpecificDisplayValue(
        applySportsCardSpecificDefaults({}),
        autographedField,
      ),
    ).toBe("No");
    for (const savedValue of ["Yes", "No"]) {
      expect(
        getSportsCardSpecificDefaultChanges({Autographed: savedValue}),
      ).not.toHaveProperty("Autographed");
      expect(
        getSportsCardSpecificDisplayValue(
          applySportsCardSpecificDefaults({Autographed: savedValue}),
          autographedField,
        ),
      ).toBe(savedValue);
    }
  });
});
