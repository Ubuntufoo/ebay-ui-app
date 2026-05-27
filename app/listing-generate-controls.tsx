"use client";

import {useActionState} from "react";
import {useFormStatus} from "react-dom";

import {enqueueGenerateListing} from "@/app/listing-generate-actions";
import {
  initialGenerateListingActionState,
  type GenerateListingActionState,
} from "@/app/listing-generate-state";
import type {Listing} from "@/lib/sidecar-api";

function GenerateControlsFields({listing}: {listing: Listing}) {
  const {pending} = useFormStatus();

  return (
    <>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
          Seller hints
        </span>
        <textarea
          name="seller_hints"
          defaultValue={listing.seller_hints ?? ""}
          rows={3}
          disabled={pending}
          placeholder="Optional hints for draft generation"
          className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-w-44 items-center justify-center rounded-full border border-stone-950/15 bg-stone-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
        >
          {pending ? "Generating..." : "Generate AI Draft"}
        </button>
      </div>
    </>
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
            Generate AI Draft
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Queue the backend generate_ai job for this listing. Seller hints are
            optional and persist before enqueue.
          </p>
        </div>
      </div>
      <form action={formAction} className="mt-4 grid gap-4">
        <input type="hidden" name="listing_id" value={listing.listing_id} />
        <GenerateControlsFields listing={listing} />
      </form>
      {state.error ? (
        <p className="mt-4 max-w-xl rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {state.error}
        </p>
      ) : null}
      {state.info ? (
        <p className="mt-4 max-w-xl rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          {state.info}
        </p>
      ) : null}
      {state.success ? (
        <p className="mt-4 max-w-xl rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {state.success}
        </p>
      ) : null}
    </section>
  );
}
