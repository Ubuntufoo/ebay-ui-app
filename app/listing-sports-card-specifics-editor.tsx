"use client";

import {useState} from "react";

import {
  applySportsCardSpecificDefaults,
  getSportsCardSpecificDisplayValue,
  getSportsCardSpecificDefaultChanges,
  sportsCardSpecificFields,
  updateSportsCardSpecific,
} from "@/app/sports-card-item-specifics";
import type {Listing} from "@/lib/sidecar-api";
import type {Json} from "@/lib/sidecar-api/types";

export function ListingSportsCardSpecificsEditor({listing}: {listing: Listing}) {
  const [itemSpecifics, setItemSpecifics] = useState<Json>(() =>
    applySportsCardSpecificDefaults(listing.item_specifics),
  );
  const [changes, setChanges] = useState<Record<string, string>>(() =>
    getSportsCardSpecificDefaultChanges(listing.item_specifics),
  );
  const [defaultChanges, setDefaultChanges] = useState<Record<string, string>>(
    () => getSportsCardSpecificDefaultChanges(listing.item_specifics),
  );

  if (listing.category_id !== "261328") {
    return null;
  }

  const disabled = listing.status === "generating";

  function updateField(
    field: (typeof sportsCardSpecificFields)[number],
    value: string,
  ) {
    setItemSpecifics((current) =>
      updateSportsCardSpecific(current, field, value),
    );
    setChanges((current) => ({...current, [field.persistKey]: value}));
    setDefaultChanges((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, field.persistKey)) {
        return current;
      }

      const next = {...current};
      delete next[field.persistKey];
      return next;
    });
  }

  return (
    <section
      aria-label="Sports card item specifics"
      className="mt-4 grid gap-4 rounded-[1.5rem] border border-stone-950/10 bg-white/80 p-4"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-700">
          eBay item specifics
        </p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">
          All current sports trading-card fields are shown, including unassigned fields. Changes are saved with Save edits above.
        </p>
      </div>

      <input
        type="hidden"
        form="listing-edit-form"
        name="sports_card_specific_changes"
        value={JSON.stringify(changes)}
      />
      <input
        type="hidden"
        form="listing-edit-form"
        name="sports_card_specific_default_changes"
        value={JSON.stringify(defaultChanges)}
      />

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
                  onChange={(event) => updateField(field, event.target.value)}
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
                  list={field.suggestions ? `${inputId}-suggestions` : undefined}
                  value={value}
                  disabled={disabled}
                  placeholder={
                    field.cardinality === "multi"
                      ? "Not assigned (comma-separated)"
                      : "Not assigned"
                  }
                  onChange={(event) => updateField(field, event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-950/10 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
                />
              )}
              {field.suggestions ? (
                <datalist id={`${inputId}-suggestions`}>
                  {field.suggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              ) : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}
