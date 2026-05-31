"use client";

import {useActionState, useState} from "react";
import {useFormStatus} from "react-dom";

import {approveListingForExport} from "@/app/listing-approve-export-actions";
import {
  initialApproveListingForExportActionState,
  type ApproveListingForExportActionState,
} from "@/app/listing-approve-export-state";
import {retryPublishListingAction} from "@/app/listing-retry-publish-actions";
import {
  initialRetryPublishListingActionState,
  type RetryPublishListingActionState,
} from "@/app/listing-retry-publish-state";
import {
  getListingStatusBadgeClassName,
  getListingStatusLabel,
  getListingSubStatusLabel,
} from "@/app/listing-status-flow";
import {getListingPricingLinks} from "@/app/listing-pricing-links";
import {getTradingCardConditionApprovalMessage} from "@/app/trading-card-condition-utils";
import {ListingGenerateControls} from "@/app/listing-generate-controls";
import type {Listing} from "@/lib/sidecar-api";

const EBAY_TITLE_MAX_LENGTH = 80;

function ApproveForExportButton({disabled}: {disabled?: boolean}) {
  const {pending} = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex min-w-36 items-center justify-center rounded-full border border-stone-950/15 bg-emerald-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-50 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
    >
      {pending ? "Approving..." : "Approve For Export"}
    </button>
  );
}

function RetryPublishButton({disabled}: {disabled?: boolean}) {
  const {pending} = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex min-w-36 items-center justify-center rounded-full border border-stone-950/15 bg-amber-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-50 transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
    >
      {pending ? "Retrying..." : "Retry Publish"}
    </button>
  );
}

const FINAL_REVIEW_CHECKLIST_ITEMS = [
  "Title has been reviewed.",
  "Price has been reviewed.",
  "Category/aspects have been reviewed.",
  "Photos have been reviewed.",
  "Shipping/condition details have been reviewed.",
] as const;
type FinalReviewChecklistItem = (typeof FINAL_REVIEW_CHECKLIST_ITEMS)[number];

function createInitialChecklistState(): Record<
  FinalReviewChecklistItem,
  boolean
> {
  return Object.fromEntries(
    FINAL_REVIEW_CHECKLIST_ITEMS.map((item) => [item, false]),
  ) as Record<FinalReviewChecklistItem, boolean>;
}

function getTitleLength(title: Listing["title"]): number {
  return typeof title === "string" ? title.length : 0;
}

function isTitleTooLong(title: Listing["title"]): boolean {
  return getTitleLength(title) > EBAY_TITLE_MAX_LENGTH;
}

function getLastErrorCategory(listing: Listing): string | null {
  const context = listing.last_error_context;

  if (
    context === null ||
    typeof context !== "object" ||
    Array.isArray(context)
  ) {
    return null;
  }

  const category = context.category;

  return typeof category === "string" ? category : null;
}

function canRetryPublish(listing: Listing): boolean {
  if (listing.status !== "approved_for_export") {
    return false;
  }

  if (
    listing.sub_status !== "idle" &&
    listing.sub_status !== "publish_queued"
  ) {
    return false;
  }

  if (!listing.last_error_code) {
    return false;
  }

  const errorCategory = getLastErrorCategory(listing);
  return errorCategory === "user_fixable" || errorCategory === "recoverable";
}

function RetryPublishForm({listing}: {listing: Listing}) {
  const [state, formAction] = useActionState<
    RetryPublishListingActionState,
    FormData
  >(retryPublishListingAction, initialRetryPublishListingActionState);

  return (
    <form
      key={`${listing.listing_id}:${listing.status}:${listing.sub_status}:${listing.last_error_code ?? ""}`}
      action={formAction}
      className="mt-4 grid gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4"
    >
      <input type="hidden" name="listing_id" value={listing.listing_id} />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800">
          Publish retry available
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Fix the fields above, then retry publish.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <RetryPublishButton />
      </div>
      {state.success ? (
        <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {state.success}
        </p>
      ) : null}
      {state.error ? (
        <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function ReadOnlyStatusField({
  label,
  value,
  toneClassName,
}: {
  label: string;
  value: string;
  toneClassName?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
        {label}
      </p>
      <div
        className={`mt-2 inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${toneClassName ?? "border-stone-950/10 bg-stone-50 text-stone-700"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ApproveForExportForm({
  approveFormAction,
  approveState,
  cardConditionApprovalMessage,
  listingId,
  listingTitle,
  listingStatus,
}: {
  approveFormAction: (payload: FormData) => void;
  approveState: ApproveListingForExportActionState;
  cardConditionApprovalMessage: string | null;
  listingId: string;
  listingTitle: Listing["title"];
  listingStatus: ListingStatus;
}) {
  const [completedChecklistItems, setCompletedChecklistItems] = useState(
    createInitialChecklistState,
  );
  const isReviewChecklistComplete = FINAL_REVIEW_CHECKLIST_ITEMS.every(
    (item) => completedChecklistItems[item] === true,
  );
  const titleLength = getTitleLength(listingTitle);
  const isTitleLengthValid = !isTitleTooLong(listingTitle);
  const isApproveDisabled =
    !isReviewChecklistComplete ||
    !isTitleLengthValid ||
    cardConditionApprovalMessage !== null;

  return (
    <form action={approveFormAction} className="mt-4 grid gap-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="current_status" value={listingStatus} />
      <div className="rounded-2xl border border-emerald-300 bg-white/80 px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800">
          Final review checklist
        </p>
        {cardConditionApprovalMessage !== null ? (
          <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            {cardConditionApprovalMessage}
          </p>
        ) : null}
        {!isTitleLengthValid ? (
          <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            eBay titles must be 80 characters or fewer. Current title:{" "}
            {titleLength} characters.
          </p>
        ) : null}
        <div className="mt-3 grid gap-2">
          {FINAL_REVIEW_CHECKLIST_ITEMS.map((item) => (
            <label
              key={item}
              className="flex items-start gap-2 text-sm text-stone-700"
            >
              <input
                type="checkbox"
                checked={completedChecklistItems[item]}
                onChange={(event) =>
                  setCompletedChecklistItems((current) => ({
                    ...current,
                    [item]: event.target.checked,
                  }))
                }
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <ApproveForExportButton disabled={isApproveDisabled} />
      </div>
      {approveState.success ? (
        <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {approveState.success}
        </p>
      ) : null}
      {approveState.error ? (
        <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {approveState.error}
        </p>
      ) : null}
    </form>
  );
}

export function ListingStatusControls({
  cardConditionToken = null,
  listing,
}: {
  cardConditionToken?: string | null;
  listing: Listing;
}) {
  const [approveState, approveFormAction] = useActionState<
    ApproveListingForExportActionState,
    FormData
  >(approveListingForExport, initialApproveListingForExportActionState);
  const isGenerating = listing.status === "generating";
  const isNeedsReview = listing.status === "needs_review";
  const canRetryPublishListing = canRetryPublish(listing);
  const pricingLinks = isNeedsReview ? getListingPricingLinks(listing) : [];
  const cardConditionApprovalMessage = getTradingCardConditionApprovalMessage(
    listing,
    cardConditionToken,
  );

  return (
    <section className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-5">
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ReadOnlyStatusField
          label="Current status"
          value={getListingStatusLabel(listing.status)}
          toneClassName={getListingStatusBadgeClassName(listing.status)}
        />
        <ReadOnlyStatusField
          label="Current sub-status"
          value={getListingSubStatusLabel(listing.sub_status)}
        />
      </div>

      {isGenerating ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          AI generation is in progress. Edits and status actions are locked
          until the draft returns for review.
        </div>
      ) : null}

      {pricingLinks.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-stone-950/10 bg-white/70 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                Pricing research
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {pricingLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center justify-center rounded-full border border-stone-950/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <ListingGenerateControls listing={listing} />
      </div>

      {canRetryPublishListing ? <RetryPublishForm listing={listing} /> : null}

      {isNeedsReview ? (
        <ApproveForExportForm
          key={`${listing.listing_id}:${listing.status}`}
          approveFormAction={approveFormAction}
          approveState={approveState}
          cardConditionApprovalMessage={cardConditionApprovalMessage}
          listingId={listing.listing_id}
          listingTitle={listing.title}
          listingStatus={listing.status}
        />
      ) : null}
    </section>
  );
}
