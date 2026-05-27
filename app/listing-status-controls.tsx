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
import {updateListingStatus} from "@/app/listing-status-actions";
import {
  getAllowedManualStatusTransitions,
  getListingStatusBadgeClassName,
  getListingStatusLabel,
  getListingSubStatusLabel,
} from "@/app/listing-status-flow";
import {getListingPricingLinks} from "@/app/listing-pricing-links";
import {ListingGenerateControls} from "@/app/listing-generate-controls";
import {
  initialUpdateListingStatusActionState,
  type UpdateListingStatusActionState,
} from "@/app/listing-status-state";
import type {Listing, ListingStatus} from "@/lib/sidecar-api";

function StatusActionButton({
  disabled,
  nextStatus,
}: {
  disabled?: boolean;
  nextStatus: ListingStatus;
}) {
  const {data, pending} = useFormStatus();
  const submittedStatus = data?.get("next_status");
  const isActiveAction =
    pending && typeof submittedStatus === "string" && submittedStatus === nextStatus;

  return (
    <button
      type="submit"
      name="next_status"
      value={nextStatus}
      disabled={pending || disabled}
      className="inline-flex min-w-36 items-center justify-center rounded-full border border-stone-950/15 bg-stone-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
    >
      {isActiveAction ? "Updating..." : getListingStatusLabel(nextStatus)}
    </button>
  );
}

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

function createInitialChecklistState(): Record<FinalReviewChecklistItem, boolean> {
  return Object.fromEntries(
    FINAL_REVIEW_CHECKLIST_ITEMS.map((item) => [item, false]),
  ) as Record<FinalReviewChecklistItem, boolean>;
}

function getLastErrorCategory(listing: Listing): string | null {
  const context = listing.last_error_context;

  if (context === null || typeof context !== "object" || Array.isArray(context)) {
    return null;
  }

  const category = context.category;

  return typeof category === "string" ? category : null;
}

function canRetryPublish(listing: Listing): boolean {
  if (listing.status !== "approved_for_export") {
    return false;
  }

  if (listing.sub_status !== "idle" && listing.sub_status !== "publish_queued") {
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
  listingId,
  listingStatus,
}: {
  approveFormAction: (payload: FormData) => void;
  approveState: ApproveListingForExportActionState;
  listingId: string;
  listingStatus: ListingStatus;
}) {
  const [completedChecklistItems, setCompletedChecklistItems] = useState(
    createInitialChecklistState,
  );
  const isReviewChecklistComplete = FINAL_REVIEW_CHECKLIST_ITEMS.every(
    (item) => completedChecklistItems[item] === true,
  );

  return (
    <form action={approveFormAction} className="mt-4 grid gap-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="current_status" value={listingStatus} />
      <div className="rounded-2xl border border-emerald-300 bg-white/80 px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800">
          Final review checklist
        </p>
        <p className="mt-2 text-sm leading-6 text-emerald-900">
          Confirm each item before approving this listing for export. This is a
          pre-publish safety gate.
        </p>
        <div className="mt-3 grid gap-2">
          {FINAL_REVIEW_CHECKLIST_ITEMS.map((item) => (
            <label key={item} className="flex items-start gap-2 text-sm text-stone-700">
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
        <ApproveForExportButton disabled={!isReviewChecklistComplete} />
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

export function ListingStatusControls({listing}: {listing: Listing}) {
  const [approveState, approveFormAction] = useActionState<
    ApproveListingForExportActionState,
    FormData
  >(
    approveListingForExport,
    initialApproveListingForExportActionState,
  );
  const [state, formAction] = useActionState<
    UpdateListingStatusActionState,
    FormData
  >(
    updateListingStatus,
    initialUpdateListingStatusActionState,
  );
  const isGenerating = listing.status === "generating";
  const isNeedsReview = listing.status === "needs_review";
  const canRetryPublishListing = canRetryPublish(listing);
  const nextStatuses = getAllowedManualStatusTransitions(listing.status);
  const pricingLinks = isNeedsReview ? getListingPricingLinks(listing) : [];

  return (
    <section className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">
            Manual test-flow control
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">
            Server-side only status advance/reset for local early workflow
            testing. Seller-editable listing fields are not submitted here.
          </p>
        </div>
        <span className="rounded-full border border-amber-400/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-900">
          Local testing only
        </span>
      </div>

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

      {isNeedsReview ? (
        <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          AI draft ready for review. Confirm or edit the generated fields before
          approving for export.
        </div>
      ) : null}

      {pricingLinks.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-stone-950/10 bg-white/70 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                Pricing research
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                Open external comps from the current draft fields.
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
          listingId={listing.listing_id}
          listingStatus={listing.status}
        />
      ) : null}

      <form action={formAction} className="mt-4 grid gap-4">
        <fieldset disabled={isGenerating} className="grid gap-4">
          <input type="hidden" name="listing_id" value={listing.listing_id} />
          <input type="hidden" name="current_status" value={listing.status} />

          {nextStatuses.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {nextStatuses.map((nextStatus) => (
                <StatusActionButton
                  key={nextStatus}
                  disabled={isGenerating}
                  nextStatus={nextStatus}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-stone-950/10 bg-white/70 px-4 py-3 text-sm text-stone-600">
              No manual test transitions are available for{" "}
              {getListingStatusLabel(listing.status)}.
            </p>
          )}
        </fieldset>
      </form>

      {state.success ? (
        <p className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {state.success}
        </p>
      ) : null}

      {state.error ? (
        <p className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
