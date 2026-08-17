import {describe, expect, it} from "vitest";

import type {Listing} from "@/lib/sidecar-api";
import type {ListingLatestPricingResearchSummary} from "@/lib/sidecar-api/types";

import {
  buildListingPricingSearchText,
  getListingPricingLinks,
} from "@/app/listing-pricing-links";

function buildListing(overrides: Partial<Listing> = {}): Listing {
  return {
    approved_for_export_at: null,
    auto_pricing_enabled: true,
    capture_mode: null,
    category_id: null,
    condition_id: null,
    condition_notes: null,
    created_at: "2026-05-20T00:00:00.000Z",
    description: null,
    ebay_listing_id: null,
    ebay_listing_status: null,
    ebay_listing_url: null,
    ebay_offer_id: null,
    ese_eligible: null,
    estimated_weight_oz: null,
    exported_at: null,
    handling_days: null,
    id: "listing-row-id",
    image_urls: [],
    item_specifics: {},
    last_error_at: null,
    last_error_code: null,
    listing_id: "LIST-001",
    listing_type: null,
    merchant_location_key: null,
    package_type: null,
    price: null,
    r2_delete_after: null,
    r2_deleted_at: null,
    r2_object_keys: [],
    r2_retention_policy: null,
    seller_hints: null,
    shipping_profile: null,
    sku: null,
    sold_at: null,
    status: "needs_review",
    sub_status: "idle",
    title: "Base title",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

function buildPricingResearch(
  overrides: Partial<ListingLatestPricingResearchSummary> = {},
): ListingLatestPricingResearchSummary {
  return {
    comp_summary: {
      rejected_comp_count: 0,
      rejected_comp_ids: [],
      selected_comp_count: 0,
      selected_comp_ids: [],
      total_comp_count: 0,
    },
    confidence: null,
    created_at: "2026-08-12T00:00:00.000Z",
    error_code: null,
    error_message: null,
    listing_id: "LIST-001",
    llm_price_explanation: null,
    median_sold_price: null,
    price_adjustment: null,
    pricing_model_name: null,
    provider: "soldcomps",
    query: null,
    research_id: "research-id",
    sold_count: null,
    status: "success",
    suggested_price: null,
    terapeak_max_price: null,
    terapeak_min_price: null,
    updated_at: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("listing pricing links", () => {
  it("uses the exact listing title for pricing searches", () => {
    const query = buildListingPricingSearchText(
      buildListing({
        title: "1995-96 SkyBox NBA Hoops #379 Jim McIlvaine Rookie Card",
        item_specifics: {
          Manufacturer: "nba hoops",
          Player: "jim mcilvaine",
          Year: "1995-96",
        },
      }),
    );

    expect(query).toBe(
      "1995-96 SkyBox NBA Hoops #379 Jim McIlvaine Rookie Card",
    );
  });

  it("builds exact SportsCardsPro and eBay Terapeak URLs", () => {
    const links = getListingPricingLinks(
      buildListing({
        title: "1995-96 SkyBox NBA Hoops #379 Jim McIlvaine Rookie Card",
        item_specifics: {
          Manufacturer: "nba hoops",
          Player: "jim mcilvaine",
          Sport: "Basketball",
          Year: "1995-96",
        },
      }),
    );

    expect(links.map((link) => link.label)).toEqual([
      "SportsCardsPro",
      "eBay Terapeak",
    ]);
    expect(links[0]?.href).toBe(
      "https://www.sportscardspro.com/search-products?q=1995-96+SkyBox+NBA+Hoops+%23379+Jim+McIlvaine+Rookie+Card&type=prices&sport=basketball-cards",
    );
    expect(links[1]?.label).toBe("eBay Terapeak");
  });

  it("maps supported SportsCardsPro sports case-insensitively", () => {
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: " baseball ",
          },
          title: "Baseball card",
        }),
      )[0]?.href,
    ).toContain("sport=baseball-cards");
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: "BASKETBALL",
          },
          title: "Basketball card",
        }),
      )[0]?.href,
    ).toContain("sport=basketball-cards");
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: "Football",
          },
          title: "Football card",
        }),
      )[0]?.href,
    ).toContain("sport=football-cards");
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: "hOcKeY",
          },
          title: "Hockey card",
        }),
      )[0]?.href,
    ).toContain("sport=hockey-cards");
  });

  it("omits unsupported or malformed SportsCardsPro sport values", () => {
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {},
          title: "No sport card",
        }),
      )[0]?.href,
    ).not.toContain("sport=");
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: "  ",
          },
          title: "Blank sport card",
        }),
      )[0]?.href,
    ).not.toContain("sport=");
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: "Soccer",
          },
          title: "Unsupported sport card",
        }),
      )[0]?.href,
    ).not.toContain("sport=");
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: ["Baseball"],
          },
          title: "Array sport card",
        }),
      )[0]?.href,
    ).not.toContain("sport=");
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: {
              label: "Baseball",
            },
          },
          title: "Object sport card",
        }),
      )[0]?.href,
    ).not.toContain("sport=");
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {
            Sport: "baseball-cards",
          },
          title: "Already suffixed sport card",
        }),
      )[0]?.href,
    ).not.toContain("sport=");
  });

  it("falls back to structured pricing text when the title is missing", () => {
    const query = buildListingPricingSearchText(
      buildListing({
        title: null,
        item_specifics: {
          Manufacturer: "nba hoops",
          Player: "michael jordan",
          Year: "1990",
        },
      }),
    );

    expect(query).toBe("1990 Nba Hoops: Michael Jordan");
  });

  it("builds an eBay Terapeak URL from the listing title", () => {
    const links = getListingPricingLinks(
      buildListing({
        title: "Michael Jordan 1990 NBA Hoops #65",
      }),
      1789920000000,
    );

    expect(links[1]?.label).toBe("eBay Terapeak");
    expect(links[1]?.href).toBe(
      "https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=Michael+Jordan+1990+NBA+Hoops+%2365+-psa+-bgs+-sgc+-cgc+-signature+-sig+-autograph+-autographed+-graded+-lot&dayRange=365&endDate=1789920000000&startDate=1758384000000&categoryId=261328&format=BEST_OFFER&format=FIXED_PRICE&offset=0&limit=50&tabName=SOLD&tz=America%2FNew_York",
    );
  });

  it.each([
    [1, 12],
    [4, 38],
  ])("appends the backend Terapeak price band %s-%s", (min, max) => {
    const links = getListingPricingLinks(
      buildListing({
        latest_pricing_research: buildPricingResearch({
          terapeak_max_price: max,
          terapeak_min_price: min,
        }),
      }),
      1789920000000,
    );
    const url = new URL(links[1]!.href);

    expect(url.searchParams.get("minPrice")).toBe(String(min));
    expect(url.searchParams.get("maxPrice")).toBe(String(max));
  });

  it.each([
    [null, null],
    [1, null],
    [null, 12],
    [0, 12],
    [1, Number.POSITIVE_INFINITY],
    [12, 1],
  ])("omits both Terapeak price params for invalid band %s-%s", (min, max) => {
    const links = getListingPricingLinks(
      buildListing({
        latest_pricing_research: buildPricingResearch({
          terapeak_max_price: max,
          terapeak_min_price: min,
        }),
      }),
      1789920000000,
    );
    const url = new URL(links[1]!.href);

    expect(url.searchParams.has("minPrice")).toBe(false);
    expect(url.searchParams.has("maxPrice")).toBe(false);
  });

  it("omits both Terapeak price params without latest pricing research", () => {
    const links = getListingPricingLinks(buildListing(), 1789920000000);
    const url = new URL(links[1]!.href);

    expect(url.searchParams.has("minPrice")).toBe(false);
    expect(url.searchParams.has("maxPrice")).toBe(false);
  });

  it("uses structured identity fields for Terapeak instead of title modifiers", () => {
    const links = getListingPricingLinks(
      buildListing({
        item_specifics: {
          "Card Number": "191",
          Manufacturer: "Topps",
          "Player/Athlete": "Troy Stratford",
          Year: "1988",
        },
        title: "Troy Stratford 1988 Topps #191 Rookie Card NM+",
      }),
      1789920000000,
    );
    const url = new URL(links[1]!.href);
    const keywords = url.searchParams.get("keywords");

    expect(keywords).toBe(
      "Troy Stratford 191 1988 Topps -psa -bgs -sgc -cgc -signature -sig -autograph -autographed -graded -lot",
    );
    expect(keywords).not.toContain("Rookie Card");
    expect(keywords).not.toContain("NM");
    expect(keywords).not.toContain("#191");
    expect(links[0]?.href).toContain(
      "q=Troy+Stratford+1988+Topps+%23191+Rookie+Card+NM%2B",
    );
  });

  it("builds a clean Terapeak query from partial structured identity fields", () => {
    const links = getListingPricingLinks(
      buildListing({
        item_specifics: {
          Manufacturer: "Topps",
          "Player/Athlete": "Troy Stratford",
        },
        title: "Troy Stratford Topps Rookie Card NM+",
      }),
      1789920000000,
    );
    const keywords = new URL(links[1]!.href).searchParams.get("keywords");

    expect(keywords).toBe(
      "Troy Stratford Topps -psa -bgs -sgc -cgc -signature -sig -autograph -autographed -graded -lot",
    );
  });

  it("returns the title text normalized for whitespace when specifics are missing", () => {
    const query = buildListingPricingSearchText(
      buildListing({
        item_specifics: {},
        title: "  1990   nba hoops   michael jordan  ",
      }),
    );

    expect(query).toBe("1990 nba hoops michael jordan");
  });

  it("appends Terapeak aspect filters from item specifics", () => {
    const links = getListingPricingLinks(
      buildListing({
        item_specifics: {
          League: "Major League Baseball (MLB)",
          Manufacturer: "Topps",
          "Player/Athlete": "Willie Stargell",
        },
        title: "Willie Stargell 1975 Topps",
      }),
      1789920000000,
    );

    expect(links[1]?.label).toBe("eBay Terapeak");
    expect(links[1]?.href).toContain("categoryId=261328");
    expect(links[1]?.href).toContain("format=BEST_OFFER");
    expect(links[1]?.href).toContain("format=FIXED_PRICE");
    expect(links[1]?.href).toContain(
      "aspect=League%3A%3A%3AMajor+League+Baseball+%28MLB%29",
    );
    expect(links[1]?.href).toContain("aspect=Manufacturer%3A%3A%3ATopps");
    expect(links[1]?.href).toContain(
      "aspect=Player%2FAthlete%3A%3A%3AWillie+Stargell",
    );
  });

  it("omits Terapeak aspect params when item specifics are missing", () => {
    const links = getListingPricingLinks(
      buildListing({
        item_specifics: {},
        title: "Some card",
      }),
      1789920000000,
    );

    expect(links[1]?.label).toBe("eBay Terapeak");
    expect(links[1]?.href).toContain("categoryId=261328");
    expect(links[1]?.href).not.toContain("aspect=");
  });

  it("handles partial Terapeak aspect filters safely", () => {
    const links = getListingPricingLinks(
      buildListing({
        item_specifics: {
          League: "NFL",
        },
        title: "Football card",
      }),
      1789920000000,
    );

    expect(links[1]?.label).toBe("eBay Terapeak");
    expect(links[1]?.href).toContain("aspect=League%3A%3A%3ANFL");
    expect(links[1]?.href).not.toContain("Manufacturer");
    expect(links[1]?.href).not.toContain("Player%2FAthlete");
  });

  it("recognizes canonical Player/Athlete and Manufacturer keys for Terapeak aspects", () => {
    const links = getListingPricingLinks(
      buildListing({
        item_specifics: {
          Manufacturer: "Upper Deck",
          "Player/Athlete": "Wayne Gretzky",
        },
        title: "Wayne Gretzky Upper Deck RC",
      }),
      1789920000000,
    );

    expect(links[1]?.href).toContain("aspect=Manufacturer%3A%3A%3AUpper+Deck");
    expect(links[1]?.href).toContain(
      "aspect=Player%2FAthlete%3A%3A%3AWayne+Gretzky",
    );
  });

  it("returns no links without usable query text", () => {
    expect(
      getListingPricingLinks(
        buildListing({
          item_specifics: {},
          title: null,
        }),
      ),
    ).toEqual([]);
  });
});
