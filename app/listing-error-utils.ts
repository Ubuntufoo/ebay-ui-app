import type {Listing} from "@/lib/sidecar-api";

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasPersistedListingError(listing: Listing): boolean {
  return (
    isNonEmptyString(listing.last_error_code) ||
    isNonEmptyString(listing.last_error_message)
  );
}
