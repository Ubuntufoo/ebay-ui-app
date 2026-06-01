import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";

import type {UnshippedOrder} from "@/lib/unshipped-orders";

import {
  UnshippedOrdersPageFallback,
  UnshippedOrdersPageView,
} from "./orders-page";

function buildOrder(overrides: Partial<UnshippedOrder> = {}): UnshippedOrder {
  return {
    buyer_name: "Alex Buyer",
    buyer_username: "alexbuyer",
    created_at: "2026-05-20T10:00:00.000Z",
    currency: "USD",
    line_items: [
      {
        image_url: "https://example.com/item.jpg",
        listing_id: "LIST-123",
        quantity: 2,
        sku: "SKU-123",
        title: "1990 Topps Baseball Card",
      },
    ],
    order_id: "ORDER-001",
    paid_at: "2026-05-20T10:15:00.000Z",
    ship_by_date: "2026-05-22T00:00:00.000Z",
    shipping_address: {
      city: "Austin",
      country: "US",
      line1: "123 Main St",
      line2: "Apt 4",
      name: "Alex Buyer",
      postal_code: "78701",
      region: "TX",
    },
    shipping_service: "USPS Ground Advantage",
    total: 12.34,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("UnshippedOrdersPageView", () => {
  it("shows the title, count summary, and empty state when no orders exist", () => {
    render(
      <UnshippedOrdersPageView
        ordersResult={{status: "success", orders: []}}
      />,
    );

    expect(
      screen.getByRole("heading", {name: "Unshipped orders"}),
    ).not.toBeNull();
    expect(screen.getByText("Orders to ship: 0")).not.toBeNull();
    expect(screen.getByText("No orders to ship")).not.toBeNull();
    expect(
      screen.getByText(
        "There are no unshipped orders in the packing queue right now.",
      ),
    ).not.toBeNull();
  });

  it("renders packing-oriented order details and read-only guidance", () => {
    render(
      <UnshippedOrdersPageView
        ordersResult={{status: "success", orders: [buildOrder()]}}
      />,
    );

    expect(screen.getByText("Orders to ship: 1")).not.toBeNull();
    expect(screen.getByText("Order ORDER-001")).not.toBeNull();
    expect(screen.getByRole("heading", {name: "Alex Buyer"})).not.toBeNull();
    expect(screen.getByText("@alexbuyer")).not.toBeNull();
    expect(screen.getByText("USPS Ground Advantage")).not.toBeNull();
    expect(screen.getByText("123 Main St")).not.toBeNull();
    expect(screen.getByText("Apt 4")).not.toBeNull();
    expect(screen.getByText("Austin, TX, 78701")).not.toBeNull();
    expect(screen.getByText("1990 Topps Baseball Card")).not.toBeNull();
    expect(
      screen.getByText("Qty 2 · SKU SKU-123 · Listing LIST-123"),
    ).not.toBeNull();
    expect(
      screen.getByText(
        "Buy and print shipping labels in eBay Seller Hub for now. This page is read-only packing visibility.",
      ),
    ).not.toBeNull();
    expect(screen.queryByRole("button", {name: /print label/i})).toBeNull();
    expect(screen.queryByRole("button", {name: /mark shipped/i})).toBeNull();
    expect(screen.queryByRole("button", {name: /upload tracking/i})).toBeNull();
  });

  it("shows a non-fatal error state when loading fails", () => {
    render(
      <UnshippedOrdersPageView
        ordersResult={{
          message: "Could not load unshipped orders",
          status: "error",
        }}
      />,
    );

    expect(screen.getByText("Packing queue unavailable")).not.toBeNull();
    expect(screen.getByText("Could not load unshipped orders")).not.toBeNull();
  });

  it("renders a loading fallback", () => {
    render(<UnshippedOrdersPageFallback />);

    expect(screen.getByText("Unshipped orders")).not.toBeNull();
    expect(screen.getByText("Loading unshipped orders")).not.toBeNull();
  });

  it("includes a small link back to listings", () => {
    render(
      <UnshippedOrdersPageView
        ordersResult={{status: "success", orders: []}}
      />,
    );

    expect(screen.getByRole("link", {name: "Back to listings"})).not.toBeNull();
    expect(
      screen.getByRole("link", {name: "Back to listings"}).getAttribute("href"),
    ).toBe("/");
  });
});
