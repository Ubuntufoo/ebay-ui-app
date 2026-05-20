import {describe, expect, it} from "vitest";

import type {Listing} from "@/lib/sidecar-api";

import {
  buildListingPricingSearchText,
  getListingPricingLinks,
} from "@/app/listing-pricing-links";

function buildListing(overrides: Partial<Listing> = {}): Listing {
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
    status: "needs_review",
    sub_status: "idle",
    title: "Base title",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("listing pricing links", () => {
  it("builds normalized card query from structured draft fields", () => {
    const query = buildListingPricingSearchText(
      buildListing({
        item_specifics: {
          Manufacturer: "nba hoops",
          Player: "michael jordan",
          Year: "1990",
        },
        title: "ignored when structured fields are stronger",
      }),
    );

    expect(query).toBe("1990 Nba Hoops: Michael Jordan");
  });

  it("builds exact 130point and SportsCardsPro URLs", () => {
    const links = getListingPricingLinks(
      buildListing({
        item_specifics: {
          Manufacturer: "nba hoops",
          Player: "michael jordan",
          Year: "1990",
        },
      }),
    );

    expect(links.map((link) => link.label)).toEqual([
      "130point",
      "SportsCardsPro",
    ]);
    expect(links[0]?.href).toBe(
      "https://130point.com/search#q=1990%20Nba%20Hoops%3A%20Michael%20Jordan",
    );
    expect(links[1]?.href).toBe(
      "https://www.sportscardspro.com/search-products?q=1990+Nba+Hoops%3A+Michael+Jordan&type=prices",
    );
  });

  it("falls back to title-derived normalized text when specifics are missing", () => {
    const query = buildListingPricingSearchText(
      buildListing({
        item_specifics: {},
        title: "  1990   nba hoops   michael jordan  ",
      }),
    );

    expect(query).toBe("1990 Nba Hoops Michael Jordan");
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
