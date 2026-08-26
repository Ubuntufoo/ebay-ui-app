"use client";

import {useActionState, useRef, useState} from "react";

import {saveListingEdits} from "@/app/listing-actions";
import {initialSaveListingEditsActionState} from "@/app/listing-edit-state";
import {
  getListingPriceError,
  MIN_LISTING_PRICE,
} from "@/app/listing-price-validation";
import {ListingImageOrderManager} from "@/app/listing-image-gallery";
import {ListingSportsCardSpecificsEditor} from "@/app/listing-sports-card-specifics-editor";
import {
  ListingPricingResearchPanel,
  ListingReviewGate,
  ListingStatusControls,
} from "@/app/listing-status-controls";
import {
  buildStructuredSkuPreview,
  getStructuredSkuPrefixFromItemSpecifics,
  setStructuredSkuPrefixInItemSpecifics,
  structuredSkuPrefixLabels,
  structuredSkuPrefixes,
} from "@/app/structured-sku-utils";
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
  form,
  pending,
  pendingLabel,
  label,
}: {
  disabled: boolean;
  form: string;
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      form={form}
      disabled={pending || disabled}
      className="inline-flex min-w-36 items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

const titleQuickAdds = ["Rookie Card"] as const;

export function ListingEditForm({listing}: {listing: Listing}) {
  const [state, formAction, isPending] = useActionState(
    saveListingEdits,
    initialSaveListingEditsActionState,
  );
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [itemSpecificsText, setItemSpecificsText] = useState(() =>
    formatItemSpecifics(
      normalizeItemSpecificsTradingCardCondition(listing.item_specifics),
    ),
  );
  const [priceError, setPriceError] = useState<string | null>(null);
  const [titleLength, setTitleLength] = useState(
    () => (listing.title ?? "").length,
  );
  const itemSpecificsState = parseItemSpecificsText(itemSpecificsText);
  const cardConditionToken = getCardConditionTokenFromItemSpecifics(
    itemSpecificsState.value as Parameters<
      typeof getCardConditionTokenFromItemSpecifics
    >[0],
  );
  const normalizedCardConditionToken =
    normalizeTradingCardConditionToken(cardConditionToken);
  const selectedCardConditionValue = normalizedCardConditionToken ?? "";
  const isGenerating = listing.status === "generating";
  const isNeedsReview = listing.status === "needs_review";
  const selectedStructuredSkuPrefix = getStructuredSkuPrefixFromItemSpecifics(
    itemSpecificsState.value as Listing["item_specifics"],
  );
  const structuredSkuPreview = buildStructuredSkuPreview(
    listing.listing_id,
    selectedStructuredSkuPrefix,
  );

  const itemSpecificsError = itemSpecificsState.error;

  function appendTitleText(addition: string) {
    const titleInput = titleInputRef.current;

    if (titleInput === null) {
      return;
    }

    const currentTitle = titleInput.value;
    const nextTitle =
      currentTitle === "" ? addition : `${currentTitle} ${addition}`;

    if (nextTitle.length > 80) {
      return;
    }

    titleInput.value = nextTitle;
    setTitleLength(nextTitle.length);
  }

  return (
    <div className="rounded-2xl border border-stone-950/10 bg-white/75 p-5 shadow-[0_10px_28px_rgba(68,64,60,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-bold uppercase tracking-[0.2em] text-stone-500">
            Edit listing
          </p>
          <span className="rounded-full border border-stone-950/10 bg-stone-100 px-3 py-1 font-mono text-stone-600">
            {listing.listing_id}
          </span>
        </div>
        <ListingStatusControls listing={listing} inline />
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-5">
        {isNeedsReview ? (
          <div className="w-full">
            <ListingPricingResearchPanel listing={listing} />
          </div>
        ) : null}

        <div className="grid min-w-0 flex-1 gap-4 rounded-[1.5rem] border border-stone-950/10 bg-stone-50/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SaveButton
              form="listing-edit-form"
              pending={isPending}
              disabled={isGenerating || itemSpecificsError !== null}
              label="Save edits"
              pendingLabel="Saving..."
            />
            {itemSpecificsError ? (
              <span className="text-sm text-rose-700">Fix JSON to save.</span>
            ) : null}
            <ListingReviewGate
              key={`${listing.listing_id}:${listing.status}`}
              bare
              cardConditionToken={cardConditionToken}
              listing={listing}
              showPricingResearchPanel={false}
              showRetryPricingForm={false}
            />
          </div>

          <form
            id="listing-edit-form"
            action={formAction}
            noValidate
            onSubmit={(event) => {
              if (itemSpecificsError) {
                event.preventDefault();
                return;
              }

              const priceInput =
                event.currentTarget.elements.namedItem("price");
              if (!(priceInput instanceof HTMLInputElement)) {
                return;
              }

              const trimmedPrice = priceInput.value.trim();
              if (trimmedPrice === "") {
                setPriceError(null);
                return;
              }

              const price = Number(trimmedPrice);
              const nextPriceError = Number.isFinite(price)
                ? getListingPriceError(price)
                : "Price must be a valid number.";
              if (nextPriceError) {
                event.preventDefault();
                setPriceError(nextPriceError);
                return;
              }

              setPriceError(null);
            }}
            className="grid gap-4"
          >
            {isGenerating ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                AI generation is in progress. Listing edits are locked until the
                draft is ready for review.
              </div>
            ) : null}

            <fieldset disabled={isGenerating} className="grid gap-4">
              <input
                type="hidden"
                name="listing_id"
                value={listing.listing_id}
              />

              <div className="block">
                <div className="flex flex-wrap items-baseline gap-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                  <label htmlFor="listing-title">Title</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold normal-case tracking-normal text-stone-400">
                      {titleLength}/80
                    </span>
                    {titleQuickAdds.map((addition) => (
                      <button
                        key={addition}
                        type="button"
                        onClick={() => appendTitleText(addition)}
                        className="rounded-full border border-stone-950/10 bg-white px-2.5 py-1 text-[11px] font-semibold normal-case tracking-normal text-stone-600 transition hover:border-stone-950 hover:text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                      >
                        Add &quot;{addition}&quot;
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="listing-title"
                  ref={titleInputRef}
                  type="text"
                  name="title"
                  defaultValue={listing.title ?? ""}
                  maxLength={80}
                  onChange={(event) =>
                    setTitleLength(event.target.value.length)
                  }
                  disabled={isGenerating}
                  className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                    Seller hints
                  </span>
                  <textarea
                    name="seller_hints"
                    defaultValue={listing.seller_hints ?? ""}
                    rows={2}
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
                    rows={2}
                    disabled={isGenerating}
                    className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,1.35fr)]">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                    Price
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={MIN_LISTING_PRICE}
                    step="0.01"
                    name="price"
                    defaultValue={
                      listing.price === null ? "" : String(listing.price)
                    }
                    disabled={isGenerating}
                    className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
                  />
                  {priceError ? (
                    <p className="mt-2 text-sm text-rose-700">{priceError}</p>
                  ) : null}
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
                        const updatedItemSpecifics =
                          updateItemSpecificsTradingCardCondition(
                            itemSpecificsState.value as Parameters<
                              typeof updateItemSpecificsTradingCardCondition
                            >[0],
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

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                    Condition notes
                  </span>
                  <textarea
                    name="condition_notes"
                    defaultValue={listing.condition_notes ?? ""}
                    rows={1}
                    disabled={isGenerating}
                    className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                    Item specifics (JSON)
                  </span>
                  <textarea
                    name="item_specifics"
                    value={itemSpecificsText}
                    onChange={(event) =>
                      setItemSpecificsText(event.target.value)
                    }
                    rows={9}
                    disabled={isGenerating}
                    className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 font-mono text-sm text-stone-900 outline-none transition focus:border-stone-950"
                  />
                </label>
                <div className="grid gap-4 content-start">
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
              </div>

              {itemSpecificsError ? (
                <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {itemSpecificsError}
                </p>
              ) : null}

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
        </div>
      </div>

      <ListingSportsCardSpecificsEditor listing={listing} />

      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start">
        {isNeedsReview ? (
          <section className="grid w-full gap-4 rounded-2xl border border-sky-200 bg-sky-50/80 p-4 lg:min-w-0 lg:flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-900">
                  Inventory / SKU
                </p>
                <p className="mt-1 text-sm text-sky-900/80">
                  Backend finalizes this SKU on approval.
                </p>
              </div>
              <span className="rounded-full border border-sky-200 bg-white px-3 py-1 font-mono text-sm text-sky-900">
                {listing.listing_id}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                  SKU category prefix
                </span>
                <select
                  aria-label="SKU category prefix"
                  name="sku_category_prefix"
                  value={selectedStructuredSkuPrefix}
                  onChange={(event) => {
                    if (itemSpecificsState.error !== null) {
                      return;
                    }

                    const updatedItemSpecifics =
                      setStructuredSkuPrefixInItemSpecifics(
                        itemSpecificsState.value as Listing["item_specifics"],
                        event.target
                          .value as (typeof structuredSkuPrefixes)[number],
                      );

                    setItemSpecificsText(
                      JSON.stringify(updatedItemSpecifics, null, 2),
                    );
                  }}
                  disabled={isGenerating || itemSpecificsError !== null}
                  className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
                >
                  {structuredSkuPrefixes.map((prefix) => (
                    <option key={prefix} value={prefix}>
                      {prefix} - {structuredSkuPrefixLabels[prefix]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="block">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                  Preview final SKU
                </span>
                <div className="mt-2 rounded-2xl border border-stone-950/10 bg-white px-4 py-3">
                  {structuredSkuPreview ? (
                    <p className="font-mono text-sm text-stone-900">
                      {structuredSkuPreview}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-900">
                      Listing ID is not in base Single/Lot format. Backend SKU
                      preview unavailable.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {listing.status === "assets_ready" ||
        listing.status === "needs_review" ? (
          <div className="w-full lg:w-fit lg:shrink-0">
            <ListingImageOrderManager
              imageUrls={listing.image_urls}
              listingId={listing.listing_id}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
