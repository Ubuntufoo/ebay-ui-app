"use client";

import {useActionState} from "react";
import {useFormStatus} from "react-dom";

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

export function ListingStatusControls({listing}: {listing: Listing}) {
  const [state, formAction] = useActionState<
    UpdateListingStatusActionState,
    FormData
  >(
    updateListingStatus,
    initialUpdateListingStatusActionState,
  );
  const isGenerating = listing.status === "generating";
  const isNeedsReview = listing.status === "needs_review";
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
