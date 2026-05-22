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
  record_created: "Intake created",
  image_processing_queued: "Image processing queued",
  images_processed: "Images processed",
  assets_ready: "Assets ready",
  generating: "Generating",
  needs_review: "Needs review",
  approved_for_export: "Approved for export",
  listed: "Listed",
  sold: "Sold",
} as const satisfies Record<ListingStatus, string>;

const listingStatusBadgeClasses = {
  record_created: "border-stone-300 bg-stone-100 text-stone-700",
  image_processing_queued: "border-sky-300 bg-sky-50 text-sky-800",
  images_processed: "border-cyan-300 bg-cyan-50 text-cyan-800",
  assets_ready: "border-blue-300 bg-blue-50 text-blue-800",
  generating: "border-amber-300 bg-amber-50 text-amber-900",
  needs_review: "border-emerald-300 bg-emerald-50 text-emerald-900",
  approved_for_export: "border-violet-300 bg-violet-50 text-violet-800",
  listed: "border-indigo-300 bg-indigo-50 text-indigo-800",
  sold: "border-rose-300 bg-rose-50 text-rose-800",
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

export function getListingStatusBadgeClassName(status: ListingStatus): string {
  return listingStatusBadgeClasses[status];
}

export function getListingSubStatusLabel(subStatus: ListingSubStatus): string {
  return listingSubStatusLabels[subStatus];
}
