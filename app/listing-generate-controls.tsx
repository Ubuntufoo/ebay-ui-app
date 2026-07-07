"use client";

import {startTransition, useActionState, useState} from "react";
import {useFormStatus} from "react-dom";

import {
  getPricingModifierUiState,
  type ListingPricingModifierUiState,
} from "@/app/listing-pricing-modifier-options";
import {
  enqueueGenerateListing,
  saveListingPricingModifierOptions,
} from "@/app/listing-generate-actions";
import {
  initialGenerateListingActionState,
  type GenerateListingActionState,
} from "@/app/listing-generate-state";
import type {Listing} from "@/lib/sidecar-api";

function PricingModifierCheckbox({
  checked,
  disabled,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-stone-950/10 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-stone-600 transition hover:border-stone-950/25">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        value="true"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 rounded border-stone-400 text-stone-950 focus:ring-stone-400"
      />
      <span>{label}</span>
    </label>
  );
}

function getModifierStateResetKey(listing: Listing): string {
  const modifierState = getPricingModifierUiState(listing.item_specifics);

  return `${listing.listing_id}:${modifierState.graded}:${modifierState.auto}:${modifierState.variant}`;
}

function SellerHintsField({sellerHints}: {sellerHints: string | null}) {
  const {pending} = useFormStatus();

  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
        Seller hints
      </span>
      <textarea
        name="seller_hints"
        defaultValue={sellerHints ?? ""}
        rows={3}
        disabled={pending}
        placeholder="Optional hints for draft generation"
        className="mt-2 w-full rounded-2xl border border-stone-950/10 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
      />
    </label>
  );
}

function PricingModifierControls({listing}: {listing: Listing}) {
  const {pending} = useFormStatus();
  const [modifierState, setModifierState] =
    useState<ListingPricingModifierUiState>(() =>
      getPricingModifierUiState(listing.item_specifics),
    );
  const [modifierError, setModifierError] = useState<string | null>(null);
  const [isSavingModifiers, setIsSavingModifiers] = useState(false);

  function updateModifier(
    key: keyof ListingPricingModifierUiState,
    checked: boolean,
  ) {
    const previousState = modifierState;
    const nextState = {
      ...previousState,
      [key]: checked,
    };

    setModifierState(nextState);
    setModifierError(null);
    setIsSavingModifiers(true);

    startTransition(async () => {
      const result = await saveListingPricingModifierOptions(
        listing.listing_id,
        nextState,
      );

      if (result.error) {
        setModifierState(previousState);
        setModifierError(result.error);
      }

      setIsSavingModifiers(false);
    });
  }

  return (
    <>
      <input
        type="hidden"
        name="exclude_graded"
        value={String(modifierState.graded)}
      />
      <input
        type="hidden"
        name="exclude_autographs"
        value={String(modifierState.auto)}
      />
      <input
        type="hidden"
        name="exclude_variants"
        value={String(modifierState.variant)}
      />
      <div className="flex flex-wrap items-center gap-3 lg:gap-2">
        <button
          type="submit"
          disabled={pending || isSavingModifiers}
          className="inline-flex min-w-44 items-center justify-center rounded-full border border-stone-950/15 bg-stone-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
        >
          {pending ? "Generating..." : "Generate AI Draft"}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <PricingModifierCheckbox
            checked={modifierState.graded}
            disabled={pending || isSavingModifiers}
            label="Pre-filter graded comps"
            name="exclude_graded_control"
            onChange={(checked) => updateModifier("graded", checked)}
          />
          <PricingModifierCheckbox
            checked={modifierState.auto}
            disabled={pending || isSavingModifiers}
            label="Avoid autographs"
            name="exclude_autographs_control"
            onChange={(checked) => updateModifier("auto", checked)}
          />
        </div>
        <p className="text-[11px] leading-relaxed text-stone-500">
          Uses core provider negatives. Graded/slabbed responses are always
          removed after results return, even when this toggle is off.
        </p>
      </div>
      {modifierError ? (
        <p className="max-w-xl rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {modifierError}
        </p>
      ) : null}
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
            optional and will be saved before enqueueing.
          </p>
        </div>
      </div>
      <form action={formAction} className="mt-4 grid gap-4">
        <input type="hidden" name="listing_id" value={listing.listing_id} />
        <SellerHintsField sellerHints={listing.seller_hints} />
        <PricingModifierControls
          key={getModifierStateResetKey(listing)}
          listing={listing}
        />
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
