import "server-only";

export interface UnshippedOrderLineItem {
  image_url?: string | null;
  listing_id?: string | null;
  quantity: number;
  sku?: string | null;
  title: string;
}

export interface UnshippedOrderShippingAddress {
  city?: string | null;
  country?: string | null;
  line1?: string | null;
  line2?: string | null;
  name?: string | null;
  postal_code?: string | null;
  region?: string | null;
}

export interface UnshippedOrder {
  buyer_name?: string | null;
  buyer_username: string;
  created_at: string;
  currency?: string | null;
  line_items: UnshippedOrderLineItem[];
  order_id: string;
  paid_at?: string | null;
  ship_by_date?: string | null;
  shipping_address?: UnshippedOrderShippingAddress | null;
  shipping_service?: string | null;
  total?: number | null;
}

export async function listUnshippedOrders(): Promise<UnshippedOrder[]> {
  return [];
}

export function countUnshippedOrders(orders: UnshippedOrder[]): number {
  return orders.length;
}

export type UnshippedOrdersLoadResult =
  | {status: "success"; orders: UnshippedOrder[]}
  | {status: "error"; message: string};

export async function loadUnshippedOrdersResult(): Promise<UnshippedOrdersLoadResult> {
  try {
    return {
      orders: await listUnshippedOrders(),
      status: "success",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not load unshipped orders.",
    };
  }
}
