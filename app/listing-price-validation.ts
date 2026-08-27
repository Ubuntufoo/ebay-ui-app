export const MIN_LISTING_PRICE = 0.99;

export function getListingPriceError(price: number): string | null {
  if (!Number.isFinite(price) || price < MIN_LISTING_PRICE) {
    return "Price must be at least $0.99.";
  }

  return null;
}
