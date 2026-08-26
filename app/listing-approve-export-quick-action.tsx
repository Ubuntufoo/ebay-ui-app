"use client";

import {useActionState} from "react";
import {useFormStatus} from "react-dom";

import {approveListingForExport} from "@/app/listing-approve-export-actions";
import {
  initialApproveListingForExportActionState,
  type ApproveListingForExportActionState,
} from "@/app/listing-approve-export-state";
import {getTradingCardConditionApprovalMessage} from "@/app/trading-card-condition-utils";
import type {Listing} from "@/lib/sidecar-api";

const EBAY_TITLE_MAX_LENGTH = 80;

function getSavedCardCondition(
  itemSpecifics: Listing["item_specifics"],
): string | null {
  if (
    itemSpecifics === null ||
    Array.isArray(itemSpecifics) ||
    typeof itemSpecifics !== "object"
  ) {
    return null;
  }

  const savedCondition = itemSpecifics["Card Condition"];
  return typeof savedCondition === "string" && savedCondition.trim() !== ""
    ? savedCondition.trim()
    : null;
}

function ExportButton() {
  const {pending} = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex justify-center whitespace-nowrap rounded-full border border-emerald-800 bg-emerald-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
    >
      {pending ? "Approving..." : "Approve For Export"}
    </button>
  );
}

export function ListingApproveForExportQuickAction({
  listing,
  onApproveForExport,
}: {
  listing: Listing;
  onApproveForExport: () => void;
}) {
  const [state, formAction] = useActionState<
    ApproveListingForExportActionState,
    FormData
  >(approveListingForExport, initialApproveListingForExportActionState);
  const isExportReady =
    listing.status === "needs_review" &&
    (listing.title?.length ?? 0) <= EBAY_TITLE_MAX_LENGTH &&
    getTradingCardConditionApprovalMessage(
      listing,
      getSavedCardCondition(listing.item_specifics),
    ) === null;

  if (!isExportReady) {
    return null;
  }

  return (
    <form
      action={formAction}
      className="grid gap-1"
      onSubmit={onApproveForExport}
    >
      <input type="hidden" name="listing_id" value={listing.listing_id} />
      <input type="hidden" name="current_status" value={listing.status} />
      <ExportButton />
      <span aria-live="polite" className="sr-only">
        {state.error ?? state.success}
      </span>
    </form>
  );
}
