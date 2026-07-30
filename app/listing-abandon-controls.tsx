"use client";

import {useActionState, useEffect, useId, useRef} from "react";

import {abandonListingAction} from "@/app/listing-abandon-actions";
import {
  initialAbandonListingActionState,
  type AbandonListingActionState,
} from "@/app/listing-abandon-state";

export function ListingAbandonControls({
  listingId,
  onAbandoned,
  onCancel,
}: {
  listingId: string;
  onAbandoned: (listingId: string) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    AbandonListingActionState,
    FormData
  >(abandonListingAction, initialAbandonListingActionState);
  const titleId = useId();
  const handledListingId = useRef<string | null>(null);

  useEffect(() => {
    if (
      state.abandonedListingId !== null &&
      handledListingId.current !== state.abandonedListingId
    ) {
      handledListingId.current = state.abandonedListingId;
      onAbandoned(state.abandonedListingId);
    }
  }, [onAbandoned, state.abandonedListingId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-[1.5rem] border-2 border-rose-300 bg-amber-50 p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-xl text-amber-900"
          >
            ⚠
          </span>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-stone-950">
              Confirm Listing Abandonment
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-700">
              Permanently abandon listing{" "}
              <span className="font-mono font-semibold">{listingId}</span>?
              This cannot be undone and deletes its generated data,
              images/files, and saved history.
            </p>
          </div>
        </div>

        <form action={formAction} className="mt-5">
          <input type="hidden" name="listing_id" value={listingId} />
          {state.error ? (
            <p
              role="alert"
              className="rounded-2xl border border-rose-300 bg-rose-100 px-4 py-3 text-sm text-rose-900"
            >
              {state.error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={onCancel}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full border border-rose-800 bg-rose-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Abandoning..." : "Confirm"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
