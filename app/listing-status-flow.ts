import type {ListingStatus, ListingSubStatus} from "@/lib/sidecar-api";

export const manualStatusTransitions = {
  record_created: ["assets_ready"],
  assets_ready: ["generating"],
  generating: ["assets_ready", "needs_review"],
  needs_review: ["assets_ready"],
} as const satisfies Partial<Record<ListingStatus, readonly ListingStatus[]>>;

export type ManualTestStatus = keyof typeof manualStatusTransitions;
export type AllowedNextManualTestStatus =
  (typeof manualStatusTransitions)[ManualTestStatus][number];

const listingStatusLabels = {
  record_created: "Record created",
  image_processing_queued: "Image processing queued",
  images_processed: "Images processed",
  assets_ready: "Assets ready",
  generating: "Generating",
  needs_review: "Needs review",
  approved_for_export: "Approved for export",
  listed: "Listed",
  sold: "Sold",
} as const satisfies Record<ListingStatus, string>;

const listingSubStatusLabels = {
  grouping_images: "Grouping images",
  preparing_files: "Preparing files",
  waiting_for_image_worker: "Waiting for image worker",
  processing_images: "Processing images",
  waiting_for_r2_upload: "Waiting for R2 upload",
  waiting_for_seller_hints: "Waiting for seller hints",
  ready_to_generate: "Ready to generate",
  ai_call_in_progress: "AI call in progress",
  review_pending: "Review pending",
  publish_queued: "Publish queued",
  publishing_to_ebay: "Publishing to eBay",
  active_live: "Active live",
  awaiting_packaging: "Awaiting packaging",
  shipped: "Shipped",
  idle: "Idle",
} as const satisfies Record<ListingSubStatus, string>;

export function isManualTestStatus(value: string): value is ManualTestStatus {
  return value in manualStatusTransitions;
}

export function isAllowedNextStatus(
  currentStatus: ManualTestStatus,
  nextStatus: string,
): nextStatus is AllowedNextManualTestStatus {
  return manualStatusTransitions[currentStatus].some(
    (allowedStatus) => allowedStatus === nextStatus,
  );
}

export function getAllowedManualStatusTransitions(
  status: ListingStatus,
): readonly ListingStatus[] {
  if (!isManualTestStatus(status)) {
    return [];
  }

  return manualStatusTransitions[status];
}

export function getListingStatusLabel(status: ListingStatus): string {
  return listingStatusLabels[status];
}

export function getListingSubStatusLabel(subStatus: ListingSubStatus): string {
  return listingSubStatusLabels[subStatus];
}
