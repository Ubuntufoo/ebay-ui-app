"use client";

import {useActionState} from "react";
import {useFormStatus} from "react-dom";

import {enqueueGenerateListing} from "@/app/listing-generate-actions";
import {
  initialGenerateListingActionState,
  type GenerateListingActionState,
} from "@/app/listing-generate-state";
import type {Listing} from "@/lib/sidecar-api";

function GenerateButton() {
  const {pending} = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-w-36 items-center justify-center rounded-full border border-stone-950/15 bg-stone-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
    >
      {pending ? "Generating..." : "Generate"}
    </button>
  );
}

export function ListingGenerateControls({listing}: {listing: Listing}) {
  const [state, formAction] = useActionState<
    GenerateListingActionState,
    FormData
  >(enqueueGenerateListing, initialGenerateListingActionState);

  if (listing.status !== "assets_ready") {
    return null;
  }

  return (
    <section className="rounded-2xl border border-stone-950/10 bg-white/80 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
            Generate AI
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Queue the backend generate_ai job for this listing.
          </p>
        </div>
        <form action={formAction} className="flex flex-col items-end gap-3">
          <input type="hidden" name="listing_id" value={listing.listing_id} />
          <GenerateButton />
          {state.error ? (
            <p className="max-w-sm rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {state.error}
            </p>
          ) : null}
          {state.info ? (
            <p className="max-w-sm rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              {state.info}
            </p>
          ) : null}
          {state.success ? (
            <p className="max-w-sm rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {state.success}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
