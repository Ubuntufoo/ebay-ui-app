"use client";

import {useActionState, useEffect, useId, useRef} from "react";

import {deleteSandboxListingAction} from "@/app/listing-sandbox-delete-actions";
import {
  initialDeleteSandboxListingActionState,
  type DeleteSandboxListingActionState,
} from "@/app/listing-sandbox-delete-state";

export function ListingSandboxDeleteControls({
  expectedSku,
  expectedUpdatedAt,
  listingId,
  onCancel,
  onDeleted,
}: {
  expectedSku: string;
  expectedUpdatedAt: string;
  listingId: string;
  onCancel: () => void;
  onDeleted: (listingId: string) => void;
}) {
  const [state, formAction, pending] = useActionState<
    DeleteSandboxListingActionState,
    FormData
  >(deleteSandboxListingAction, initialDeleteSandboxListingActionState);
  const titleId = useId();
  const handledListingId = useRef<string | null>(null);

  useEffect(() => {
    if (
      state.deletedListingId !== null &&
      handledListingId.current !== state.deletedListingId
    ) {
      handledListingId.current = state.deletedListingId;
      onDeleted(state.deletedListingId);
    }
  }, [onDeleted, state.deletedListingId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-2xl rounded-[1.5rem] border-2 border-rose-500 bg-rose-50 p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-rose-500 bg-rose-100 text-xl text-rose-900"
          >
            ⚠
          </span>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-stone-950">
              Confirm Sandbox Listing Deletion
            </h2>
            <dl className="mt-3 grid gap-2 text-sm text-stone-800 sm:grid-cols-[8rem_1fr]">
              <dt className="font-bold">Listing ID</dt>
              <dd className="font-mono font-semibold">{listingId}</dd>
              <dt className="font-bold">Structured SKU</dt>
              <dd className="font-mono font-semibold">{expectedSku}</dd>
            </dl>
            <p className="mt-4 text-sm font-semibold leading-6 text-rose-950">
              This ends and deletes the sandbox eBay listing, offer, and
              inventory item. It also permanently deletes local R2 images,
              watcher files, the listing row, and associated jobs and history.
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-800">
              This cannot be undone. Sold or order-linked listings are refused
              by the backend.
            </p>
          </div>
        </div>

        <form action={formAction} className="mt-5">
          <input type="hidden" name="listing_id" value={listingId} />
          <input type="hidden" name="expected_sku" value={expectedSku} />
          <input
            type="hidden"
            name="expected_updated_at"
            value={expectedUpdatedAt}
          />
          {state.error ? (
            <p
              role="alert"
              className="rounded-2xl border border-rose-400 bg-white px-4 py-3 text-sm text-rose-900"
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
              className="rounded-full border border-rose-900 bg-rose-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
