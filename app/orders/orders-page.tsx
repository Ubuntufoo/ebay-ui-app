import type {UnshippedOrder} from "@/lib/unshipped-orders";
import Link from "next/link";

type OrdersPageResult =
  | {status: "success"; orders: UnshippedOrder[]}
  | {status: "error"; message: string};

function formatMoney(
  total: number | null | undefined,
  currency?: string | null,
) {
  if (total === null || total === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    currency: currency ?? "USD",
    style: "currency",
  }).format(total);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShippingAddress(
  shippingAddress: UnshippedOrder["shipping_address"],
): string[] {
  if (!shippingAddress) {
    return [];
  }

  const lines = [
    shippingAddress.name,
    shippingAddress.line1,
    shippingAddress.line2,
    [shippingAddress.city, shippingAddress.region, shippingAddress.postal_code]
      .filter(Boolean)
      .join(", "),
    shippingAddress.country,
  ];

  return lines.filter((line): line is string => Boolean(line && line.trim()));
}

function BackToListingsLink() {
  return (
    <div className="mb-5 flex justify-start">
      <Link
        href="/"
        className="inline-flex items-center rounded-full border border-stone-950/10 bg-white/70 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
      >
        Back to listings
      </Link>
    </div>
  );
}

function UnshippedOrdersEmptyState() {
  return (
    <div className="mt-6 flex min-h-[20rem] items-center justify-center rounded-[1.75rem] border border-dashed border-stone-950/15 bg-stone-50/70 px-6 text-center">
      <div className="max-w-lg">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-500">
          No orders to ship
        </p>
        <p className="mt-3 text-lg leading-8 text-stone-600">
          There are no unshipped orders in the packing queue right now.
        </p>
      </div>
    </div>
  );
}

function UnshippedOrdersErrorState({message}: {message: string}) {
  return (
    <div className="mt-6 flex min-h-[20rem] items-center justify-center rounded-[1.75rem] border border-rose-300/70 bg-rose-50/80 px-6 text-center">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-700">
          Packing queue unavailable
        </p>
        <p className="mt-3 text-lg leading-8 text-rose-900">{message}</p>
      </div>
    </div>
  );
}

function UnshippedOrdersLoadingState() {
  return (
    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-stone-950/10 bg-stone-50/80">
      <div className="border-b border-stone-950/10 bg-stone-100/80 px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
        Loading unshipped orders
      </div>
      <div className="space-y-3 p-5">
        {Array.from({length: 3}).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(231,229,228,0.9),rgba(245,245,244,0.9),rgba(231,229,228,0.9))]"
          />
        ))}
      </div>
    </div>
  );
}

function OrderLineItemCard({
  lineItem,
}: {
  lineItem: UnshippedOrder["line_items"][number];
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-stone-950/10 bg-white/75 p-3">
      {lineItem.image_url ? (
        <div
          role="img"
          aria-label={`${lineItem.title} thumbnail`}
          className="h-16 w-16 rounded-xl border border-stone-950/10 bg-center bg-cover"
          style={{backgroundImage: `url(${lineItem.image_url})`}}
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-stone-950/10 bg-stone-100 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">
          No image
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-stone-900">{lineItem.title}</p>
        <p className="mt-1 text-sm text-stone-600">
          Qty {lineItem.quantity}
          {lineItem.sku ? ` · SKU ${lineItem.sku}` : ""}
          {lineItem.listing_id ? ` · Listing ${lineItem.listing_id}` : ""}
        </p>
      </div>
    </div>
  );
}

function UnshippedOrderCard({order}: {order: UnshippedOrder}) {
  const shippingAddressLines = formatShippingAddress(order.shipping_address);

  return (
    <article className="rounded-[1.75rem] border border-stone-950/10 bg-white/80 p-5 shadow-[0_14px_40px_rgba(68,64,60,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
            Order {order.order_id}
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
            {order.buyer_name ?? order.buyer_username}
          </h3>
          <p className="mt-2 text-sm text-stone-600">@{order.buyer_username}</p>
        </div>
        <div className="rounded-full border border-stone-950/10 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-700">
          {formatMoney(order.total, order.currency)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ["Paid / ordered", formatDate(order.paid_at ?? order.created_at)],
          ["Ship by", formatDate(order.ship_by_date)],
          ["Shipping service", order.shipping_service ?? "—"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-stone-950/10 bg-stone-50/70 px-4 py-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-800">{value}</p>
          </div>
        ))}
      </div>

      {shippingAddressLines.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-stone-950/10 bg-stone-50/70 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">
            Shipping address
          </p>
          <div className="mt-2 space-y-1 text-sm text-stone-700">
            {shippingAddressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
          Line items
        </p>
        <div className="space-y-3">
          {order.line_items.map((lineItem, index) => (
            <OrderLineItemCard
              key={`${order.order_id}:${lineItem.listing_id ?? index}`}
              lineItem={lineItem}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export function UnshippedOrdersPageView({
  ordersResult,
}: {
  ordersResult: OrdersPageResult;
}) {
  return (
    <>
      <BackToListingsLink />
      {ordersResult.status === "error" ? (
        <UnshippedOrdersErrorState message={ordersResult.message} />
      ) : (
        <UnshippedOrdersPageContent orders={ordersResult.orders} />
      )}
    </>
  );
}

function UnshippedOrdersPageContent({orders}: {orders: UnshippedOrder[]}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
            Packing queue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-stone-950">
            Unshipped orders
          </h1>
        </div>
        <div className="rounded-full border border-stone-950/10 bg-stone-950 px-4 py-2 text-sm font-semibold text-stone-50">
          Orders to ship: {orders.length}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-stone-950/10 bg-stone-50/80 px-4 py-3 text-sm leading-6 text-stone-700">
        Buy and print shipping labels in eBay Seller Hub for now. This page is
        read-only packing visibility.
      </div>

      {orders.length === 0 ? (
        <UnshippedOrdersEmptyState />
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <UnshippedOrderCard key={order.order_id} order={order} />
          ))}
        </div>
      )}
    </>
  );
}

export function UnshippedOrdersPageFallback() {
  return (
    <>
      <BackToListingsLink />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-stone-500">
            Packing queue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-stone-950">
            Unshipped orders
          </h1>
        </div>
        <div className="h-10 w-32 animate-pulse rounded-full bg-stone-100" />
      </div>
      <UnshippedOrdersLoadingState />
    </>
  );
}
