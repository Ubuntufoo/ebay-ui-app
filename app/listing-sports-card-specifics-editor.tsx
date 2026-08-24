"use client";

import {useActionState, useState} from "react";

import {saveListingEdits} from "@/app/listing-actions";
import {initialSaveListingEditsActionState} from "@/app/listing-edit-state";
import {
  getSportsCardSpecificDisplayValue,
  sportsCardSpecificFields,
  updateSportsCardSpecific,
} from "@/app/sports-card-item-specifics";
import type {Listing} from "@/lib/sidecar-api";
import type {Json} from "@/lib/sidecar-api/types";

function isJsonObject(value: Json | null): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ListingSportsCardSpecificsEditor({listing}: {listing: Listing}) {
  const [state, formAction, pending] = useActionState(
    saveListingEdits,
    initialSaveListingEditsActionState,
  );
  const [itemSpecifics, setItemSpecifics] = useState<Json>(() =>
    isJsonObject(listing.item_specifics) ? {...listing.item_specifics} : {},
  );

  if (listing.category_id !== "261328") {
    return null;
  }

  const disabled = listing.status === "generating" || pending;

  return (
    <section
      aria-label="Sports card item specifics"
      className="mt-4 grid gap-4 rounded-[1.5rem] border border-stone-950/10 bg-white/80 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-700">
            eBay item specifics
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">
            All current sports trading-card fields are shown, including unassigned fields. Blank values are optional and can be filled manually.
          </p>
        </div>
        <form action={formAction}>
          <input type="hidden" name="listing_id" value={listing.listing_id} />
          <input
            type="hidden"
            name="item_specifics"
            value={JSON.stringify(itemSpecifics)}
          />
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex min-w-44 items-center justify-center rounded-full bg-stone-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {pending ? "Saving specifics..." : "Save item specifics"}
          </button>
        </form>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Item specifics saved.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sportsCardSpecificFields.map((field) => {
          const value = getSportsCardSpecificDisplayValue(itemSpecifics, field);
          const inputId = `sports-specific-${field.persistKey
            .replace(/[^a-z0-9]+/giu, "-")
            .toLowerCase()}`;

          return (
            <label key={field.label} htmlFor={inputId} className="block">
              <span className="flex min-h-8 items-end justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
                <span>{field.label}</span>
                <span className="text-right text-[9px] font-semibold normal-case tracking-normal text-stone-400">
                  {field.status}
                  {field.manualOnly ? " · manual only" : ""}
                </span>
              </span>
              {field.options ? (
                <select
                  id={inputId}
                  value={value}
                  disabled={disabled}
                  onChange={(event) =>
                    setItemSpecifics((current) =>
                      updateSportsCardSpecific(current, field, event.target.value),
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-stone-950/10 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
                >
                  <option value="">Not assigned</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={inputId}
                  type="text"
                  value={value}
                  disabled={disabled}
                  placeholder={
                    field.cardinality === "multi"
                      ? "Not assigned (comma-separated)"
                      : "Not assigned"
                  }
                  onChange={(event) =>
                    setItemSpecifics((current) =>
                      updateSportsCardSpecific(current, field, event.target.value),
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-stone-950/10 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
                />
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}
