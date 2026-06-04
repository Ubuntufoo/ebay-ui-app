"use client";

import {useActionState, useState} from "react";
import {useFormStatus} from "react-dom";

import {saveListingEdits} from "@/app/listing-actions";
import {initialSaveListingEditsActionState} from "@/app/listing-edit-state";
import {
  ListingReviewGate,
  ListingStatusControls,
} from "@/app/listing-status-controls";
import {
  getCardConditionTokenFromItemSpecifics,
  normalizeItemSpecificsTradingCardCondition,
  normalizeTradingCardConditionToken,
  tradingCardConditionOptions,
  updateItemSpecificsTradingCardCondition,
} from "@/app/trading-card-condition-utils";
import type {Listing} from "@/lib/sidecar-api";

function formatItemSpecifics(value: Listing["item_specifics"]): string {
  if (value === null) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function parseItemSpecificsText(value: string): {
  error: string | null;
  value: unknown;
} {
  const trimmed = value.trim();
  if (trimmed === "") {
    return {error: null, value: null};
  }

  try {
    return {error: null, value: JSON.parse(trimmed)};
  } catch {
    return {
      error: "Item specifics must be valid JSON.",
      value: null,
    };
  }
}

function SaveButton({
  disabled,
  pendingLabel,
  label,
}: {
  disabled: boolean;
  label: string;
  pendingLabel: string;
}) {
  const {pending} = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-w-36 items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ListingEditForm({listing}: {listing: Listing}) {
  const [state, formAction] = useActionState(
    saveListingEdits,
    initialSaveListingEditsActionState,
  );

  const [itemSpecificsText, setItemSpecificsText] = useState(() =>
    formatItemSpecifics(
      normalizeItemSpecificsTradingCardCondition(listing.item_specifics),
    ),
  );
  const itemSpecificsState = parseItemSpecificsText(itemSpecificsText);
  const cardConditionToken = getCardConditionTokenFromItemSpecifics(
    itemSpecificsState.value as Parameters<typeof getCardConditionTokenFromItemSpecifics>[0],
  );
  const normalizedCardConditionToken =
    normalizeTradingCardConditionToken(cardConditionToken);
  const normalizedItemSpecifics = normalizeItemSpecificsTradingCardCondition(
    itemSpecificsState.value as Parameters<
      typeof normalizeItemSpecificsTradingCardCondition
    >[0],
  );
  const normalizedItemSpecificsText =
    itemSpecificsState.error === null
      ? formatItemSpecifics(normalizedItemSpecifics as Listing["item_specifics"])
      : itemSpecificsText;
  const selectedCardConditionValue = normalizedCardConditionToken ?? "";
  const isGenerating = listing.status === "generating";

  const itemSpecificsError = itemSpecificsState.error;

  return (
    <div className="rounded-2xl border border-stone-950/10 bg-white/75 p-5 shadow-[0_10px_28px_rgba(68,64,60,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold uppercase tracking-[0.2em] text-stone-500">
          Edit listing
        </p>
        <span className="rounded-full border border-stone-950/10 bg-stone-100 px-3 py-1 font-mono text-stone-600">
          {listing.listing_id}
        </span>
      </div>

      <div className="mt-4 grid gap-5">
        <form
          action={formAction}
          onSubmit={(event) => {
            if (itemSpecificsError) {
              event.preventDefault();
            }
          }}
          className="grid gap-4 rounded-[1.5rem] border border-stone-950/10 bg-stone-50/60 p-4"
        >
          {isGenerating ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              AI generation is in progress. Listing edits are locked until
              the draft is ready for review.
            </div>
          ) : null}

          <fieldset disabled={isGenerating} className="grid gap-4">
            <input
              type="hidden"
              name="listing_id"
              value={listing.listing_id}
            />
            <input
              type="hidden"
              name="item_specifics"
              value={normalizedItemSpecificsText}
            />

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                Title
              </span>
              <input
                type="text"
                name="title"
                defaultValue={listing.title ?? ""}
                disabled={isGenerating}
                className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                  Seller hints
                </span>
                <textarea
                  name="seller_hints"
                  defaultValue={listing.seller_hints ?? ""}
                  rows={3}
                  disabled={isGenerating}
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
                  rows={4}
                  disabled={isGenerating}
                  className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                  Price
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  name="price"
                  defaultValue={
                    listing.price === null ? "" : String(listing.price)
                  }
                  disabled={isGenerating}
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
                  disabled={isGenerating}
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
                  disabled={isGenerating}
                  className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                  Condition notes
                </span>
                <textarea
                  name="condition_notes"
                  defaultValue={listing.condition_notes ?? ""}
                  rows={3}
                  disabled={isGenerating}
                  className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
                />
              </label>

              <div className="grid gap-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                    Card Condition
                  </span>
                  <select
                    name="card_condition"
                    value={selectedCardConditionValue}
                    onChange={(event) => {
                      if (itemSpecificsState.error !== null) {
                        return;
                      }

                      const nextToken = event.target.value;
                      const updatedItemSpecifics = updateItemSpecificsTradingCardCondition(
                        itemSpecificsState.value as Parameters<typeof updateItemSpecificsTradingCardCondition>[0],
                        nextToken === "" ? null : nextToken,
                      );

                      if (updatedItemSpecifics === null) {
                        return;
                      }

                      setItemSpecificsText(
                        updatedItemSpecifics === null
                          ? ""
                          : JSON.stringify(updatedItemSpecifics, null, 2),
                      );
                    }}
                    disabled={isGenerating || itemSpecificsError !== null}
                    className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
                  >
                    <option value="">Select card condition</option>
                    {tradingCardConditionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {cardConditionToken !== null &&
                normalizedCardConditionToken === null ? (
                  <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Current saved Card Condition &quot;{cardConditionToken}
                    &quot; is not supported. Choose a supported value before
                    approving for export.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <SaveButton
                disabled={isGenerating || itemSpecificsError !== null}
                label="Save edits"
                pendingLabel="Saving..."
              />
              {itemSpecificsError ? (
                <span className="text-sm text-rose-700">
                  Fix JSON to save.
                </span>
              ) : null}
            </div>

            {state.success ? (
              <p className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Listing edits saved.
              </p>
            ) : null}

            {state.error ? (
              <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {state.error}
              </p>
            ) : null}
          </fieldset>
        </form>

        <ListingStatusControls listing={listing} />

        <ListingReviewGate
          key={`${listing.listing_id}:${listing.status}`}
          cardConditionToken={cardConditionToken}
          listing={listing}
        />

        <div className="grid gap-4 rounded-[1.5rem] border border-stone-950/10 bg-stone-50/60 p-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
              Item specifics (JSON)
            </span>
            <textarea
              value={itemSpecificsText}
              onChange={(event) => setItemSpecificsText(event.target.value)}
              rows={9}
              disabled={isGenerating}
              className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 font-mono text-sm text-stone-900 outline-none transition focus:border-stone-950"
            />
          </label>

          {itemSpecificsError ? (
            <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {itemSpecificsError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
