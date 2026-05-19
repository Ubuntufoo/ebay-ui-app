"use client";

import {useActionState, useMemo, useState} from "react";
import {useFormStatus} from "react-dom";

import {saveListingEdits} from "@/app/listing-actions";
import {initialSaveListingEditsActionState} from "@/app/listing-edit-state";
import {ListingStatusControls} from "@/app/listing-status-controls";
import type {Listing} from "@/lib/sidecar-api";

function formatItemSpecifics(value: Listing["item_specifics"]): string {
  if (value === null) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function SaveButton({disabled}: {disabled: boolean}) {
  const {pending} = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-w-36 items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
    >
      {pending ? "Saving..." : "Save edits"}
    </button>
  );
}

export function ListingEditForm({listing}: {listing: Listing}) {
  const [state, formAction] = useActionState(
    saveListingEdits,
    initialSaveListingEditsActionState,
  );

  const [itemSpecificsText, setItemSpecificsText] = useState(() =>
    formatItemSpecifics(listing.item_specifics),
  );

  const itemSpecificsError = useMemo(() => {
    const trimmed = itemSpecificsText.trim();
    if (trimmed === "") {
      return null;
    }

    try {
      JSON.parse(trimmed);
      return null;
    } catch {
      return "Item specifics must be valid JSON.";
    }
  }, [itemSpecificsText]);

  return (
    <div className="rounded-2xl border border-stone-950/10 bg-white/75 p-5 shadow-[0_10px_28px_rgba(68,64,60,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
          Edit listing
        </p>
        <span className="rounded-full border border-stone-950/10 bg-stone-100 px-3 py-1 text-xs font-mono text-stone-600">
          {listing.listing_id}
        </span>
      </div>

      <div className="mt-4">
        <ListingStatusControls listing={listing} />
      </div>

      <form action={formAction} className="mt-4 grid gap-4 border-t border-stone-950/10 pt-4">
        <input type="hidden" name="listing_id" value={listing.listing_id} />

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
            Title
          </span>
          <input
            type="text"
            name="title"
            defaultValue={listing.title ?? ""}
            className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
            Seller hints
          </span>
          <textarea
            name="seller_hints"
            defaultValue={listing.seller_hints ?? ""}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
            Description
          </span>
          <textarea
            name="description"
            defaultValue={listing.description ?? ""}
            rows={5}
            className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Price
            </span>
            <input
              type="text"
              inputMode="decimal"
              name="price"
              defaultValue={listing.price === null ? "" : String(listing.price)}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Category ID
            </span>
            <input
              type="text"
              name="category_id"
              defaultValue={listing.category_id ?? ""}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Condition ID
            </span>
            <input
              type="text"
              name="condition_id"
              defaultValue={listing.condition_id ?? ""}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
            Condition notes
          </span>
          <textarea
            name="condition_notes"
            defaultValue={listing.condition_notes ?? ""}
            rows={3}
            className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
            Item specifics (JSON)
          </span>
          <textarea
            name="item_specifics"
            value={itemSpecificsText}
            onChange={(event) => setItemSpecificsText(event.target.value)}
            rows={8}
            className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 font-mono text-sm text-stone-900 outline-none transition focus:border-stone-950"
          />
        </label>

        {itemSpecificsError ? (
          <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {itemSpecificsError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <SaveButton disabled={itemSpecificsError !== null} />
          {itemSpecificsError ? (
            <span className="text-sm text-rose-700">Fix JSON to save.</span>
          ) : null}
        </div>
      </form>

      {state.success ? (
        <p className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Listing edits saved.
        </p>
      ) : null}

      {state.error ? (
        <p className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
