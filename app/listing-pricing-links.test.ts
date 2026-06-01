import {describe, expect, it} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

import {
  buildListingPricingSearchText,
  getListingPricingLinks,
} from "@/app/listing-pricing-links";

function buildListing(overrides: Partial<Listing> = {}): Listing {
  const {ai_attempt_summary = null, ...restOverrides} = overrides;

  return {
    approved_for_export_at: null,
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
    ai_attempt_summary,
    status: "needs_review",
    sub_status: "idle",
    title: "Base title",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...restOverrides,
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

  it("builds exact 130point and SportsCardsPro URLs", () => {
    const links = getListingPricingLinks(
      buildListing({
        title: "1995-96 SkyBox NBA Hoops #379 Jim McIlvaine Rookie Card",
        item_specifics: {
          Manufacturer: "nba hoops",
          Player: "jim mcilvaine",
          Year: "1995-96",
        },
      }),
    );

    expect(links.map((link) => link.label)).toEqual([
      "130point",
      "SportsCardsPro",
      "eBay Terapeak",
    ]);
    expect(links[0]?.href).toBe(
      "https://130point.com/search#q=1995-96%20SkyBox%20NBA%20Hoops%20%23379%20Jim%20McIlvaine%20Rookie%20Card",
    );
    expect(links[1]?.href).toBe(
      "https://www.sportscardspro.com/search-products?q=1995-96+SkyBox+NBA+Hoops+%23379+Jim+McIlvaine+Rookie+Card&type=prices",
    );
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

    expect(links[2]?.label).toBe("eBay Terapeak");
    expect(links[2]?.href).toBe(
      "https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=Michael+Jordan+1990+NBA+Hoops+%2365+-psa+-bgs+-sgc+-cgc+-signature+-sig+-autograph+-autographed+-graded+-lot&dayRange=365&endDate=1789920000000&startDate=1758384000000&categoryId=0&format=BEST_OFFER&format=FIXED_PRICE&offset=0&limit=50&tabName=SOLD&tz=America%2FNew_York",
    );
  });

  it("preserves card title casing for Terapeak even when structured fields are available", () => {
    const links = getListingPricingLinks(
      buildListing({
        item_specifics: {
          Manufacturer: "nba hoops",
          Player: "michael jordan",
          Year: "1990",
        },
        title: "Michael Jordan 1990 NBA Hoops #65",
      }),
      1789920000000,
    );

    expect(links[2]?.href).toContain(
      "keywords=Michael+Jordan+1990+NBA+Hoops+%2365",
    );
    expect(links[2]?.href).not.toContain("Nba");
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
