import type {ListingStatus} from "@/lib/sidecar-api";

export const manualStatusTransitions = {
  record_created: ["assets_ready"],
  assets_ready: ["generating"],
  generating: ["assets_ready", "needs_review"],
  needs_review: ["assets_ready"],
} as const satisfies Partial<Record<ListingStatus, readonly ListingStatus[]>>;

export type ManualTestStatus = keyof typeof manualStatusTransitions;
export type AllowedNextManualTestStatus =
  (typeof manualStatusTransitions)[ManualTestStatus][number];

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
