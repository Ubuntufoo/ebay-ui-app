"use client";

import {
  startTransition,
  useActionState,
  useState,
} from "react";
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

const DEFAULT_BROWSE_MIN_MULTIPLIER = 0.33;
const DEFAULT_BROWSE_MAX_MULTIPLIER = 3;

function useImmediateGenerateActionState() {
  const [immediatePending, setImmediatePending] = useState(false);
  const [state, formAction] = useActionState<
    GenerateListingActionState,
    FormData
  >(
    async (previousState, formData) => {
      try {
        return await enqueueGenerateListing(previousState, formData);
      } finally {
        setImmediatePending(false);
      }
    },
    initialGenerateListingActionState,
  );

  return {
    state,
    formAction,
    immediatePending,
    onSubmit: () => setImmediatePending(true),
  };
}

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

function PricingModifierTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Avoid autographs help"
        aria-expanded={isOpen}
        onBlur={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex size-5 items-center justify-center rounded-full border border-stone-300 bg-white text-[10px] font-black text-stone-500 transition hover:border-stone-500 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
      >
        i
      </button>
      {isOpen ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 ml-2 w-72 -translate-y-1/2 rounded-2xl border border-stone-200 bg-stone-950 px-3 py-2 text-[11px] leading-5 text-stone-50 shadow-lg transition duration-75 ease-out"
        >
          Uses core provider negatives. Graded/slabbed responses are always
          removed after results return, even when this toggle is off.
        </span>
      ) : null}
    </div>
  );
}

function getModifierStateResetKey(listing: Listing): string {
  const modifierState = getPricingModifierUiState(listing.item_specifics);
  const browseState = getBrowsePricingUiState(listing.item_specifics);

  return `${listing.listing_id}:${listing.auto_pricing_enabled}:${modifierState.graded}:${modifierState.auto}:${modifierState.variant}:${browseState.skipBrowse}:${browseState.minPriceMultiplier}:${browseState.maxPriceMultiplier}`;
}

function getBrowsePricingUiState(
  itemSpecifics: Listing["item_specifics"],
) {
  if (
    itemSpecifics === null ||
    Array.isArray(itemSpecifics) ||
    typeof itemSpecifics !== "object"
  ) {
    return {
      skipBrowse: false,
      minPriceMultiplier: DEFAULT_BROWSE_MIN_MULTIPLIER,
      maxPriceMultiplier: DEFAULT_BROWSE_MAX_MULTIPLIER,
    };
  }

  const browseOptions = itemSpecifics["browsePricingOptions"];
  if (
    browseOptions === null ||
    Array.isArray(browseOptions) ||
    typeof browseOptions !== "object"
  ) {
    return {
      skipBrowse: false,
      minPriceMultiplier: DEFAULT_BROWSE_MIN_MULTIPLIER,
      maxPriceMultiplier: DEFAULT_BROWSE_MAX_MULTIPLIER,
    };
  }

  const minPriceMultiplier = browseOptions["minPriceMultiplier"];
  const maxPriceMultiplier = browseOptions["maxPriceMultiplier"];

  return {
    skipBrowse:
      typeof browseOptions["skipBrowse"] === "boolean"
        ? browseOptions["skipBrowse"]
        : false,
    minPriceMultiplier:
      typeof minPriceMultiplier === "number" &&
      Number.isFinite(minPriceMultiplier) &&
      minPriceMultiplier > 0
        ? minPriceMultiplier
        : DEFAULT_BROWSE_MIN_MULTIPLIER,
    maxPriceMultiplier:
      typeof maxPriceMultiplier === "number" &&
      Number.isFinite(maxPriceMultiplier) &&
      maxPriceMultiplier > 0
        ? maxPriceMultiplier
        : DEFAULT_BROWSE_MAX_MULTIPLIER,
  };
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

function PricingModifierControls({
  listing,
  immediatePending,
}: {
  listing: Listing;
  immediatePending: boolean;
}) {
  const {pending} = useFormStatus();
  const browseControlsDisabled = pending || immediatePending;
  const browseState = getBrowsePricingUiState(listing.item_specifics);
  const [autoPricingEnabled, setAutoPricingEnabled] = useState(
    listing.auto_pricing_enabled,
  );
  const [skipBrowse, setSkipBrowse] = useState(browseState.skipBrowse);
  const [browseMultipliers, setBrowseMultipliers] = useState({
    min: String(browseState.minPriceMultiplier),
    max:
      browseState.maxPriceMultiplier === DEFAULT_BROWSE_MAX_MULTIPLIER
        ? "3.00"
        : String(browseState.maxPriceMultiplier),
  });
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
          disabled={immediatePending || pending || isSavingModifiers}
          className="inline-flex min-w-44 items-center justify-center rounded-full border border-stone-950/15 bg-stone-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
        >
          Generate AI Draft
        </button>
        <PricingModifierCheckbox
          checked={autoPricingEnabled}
          disabled={pending}
          label="Auto Pricing?"
          name="auto_pricing_enabled"
          onChange={setAutoPricingEnabled}
        />
        <PricingModifierCheckbox
          checked={autoPricingEnabled ? skipBrowse : true}
          disabled={browseControlsDisabled || !autoPricingEnabled}
          label="Skip Browse API"
          name="skip_browse"
          onChange={setSkipBrowse}
        />
        <input
          type="hidden"
          name="skip_browse"
          value={String(skipBrowse)}
        />
        <div className="flex items-center gap-2 rounded-full border border-stone-950/10 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-stone-600">
          <label className="flex items-center gap-1.5">
            <span>Browse Min</span>
            <input
              aria-label="Browse Min multiplier"
              type="number"
              name="min_price_multiplier"
              value={browseMultipliers.min}
              min="0"
              step="any"
              disabled={
                browseControlsDisabled || !autoPricingEnabled || skipBrowse
              }
              onChange={(event) =>
                setBrowseMultipliers((previous) => ({
                  ...previous,
                  min: event.target.value,
                }))
              }
              className="w-16 rounded border border-stone-300 bg-stone-50 px-1.5 py-1 text-right text-xs font-semibold normal-case tracking-normal text-stone-900 outline-none focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span>Browse Max</span>
            <input
              aria-label="Browse Max multiplier"
              type="number"
              name="max_price_multiplier"
              value={browseMultipliers.max}
              min="0"
              step="any"
              disabled={
                browseControlsDisabled || !autoPricingEnabled || skipBrowse
              }
              onChange={(event) =>
                setBrowseMultipliers((previous) => ({
                  ...previous,
                  max: event.target.value,
                }))
              }
              className="w-16 rounded border border-stone-300 bg-stone-50 px-1.5 py-1 text-right text-xs font-semibold normal-case tracking-normal text-stone-900 outline-none focus:border-stone-950 disabled:cursor-not-allowed disabled:bg-stone-100"
            />
          </label>
        </div>
        {skipBrowse || !autoPricingEnabled || browseControlsDisabled ? (
          <>
            <input
              type="hidden"
              name="min_price_multiplier"
              value={browseMultipliers.min}
            />
            <input
              type="hidden"
              name="max_price_multiplier"
              value={browseMultipliers.max}
            />
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <PricingModifierCheckbox
            checked={modifierState.graded}
            disabled={pending || isSavingModifiers}
            label="Pre-filter graded comps"
            name="exclude_graded_control"
            onChange={(checked) => updateModifier("graded", checked)}
          />
          <div className="flex items-center gap-2">
            <PricingModifierCheckbox
              checked={modifierState.auto}
              disabled={pending || isSavingModifiers}
              label="Avoid autographs"
              name="exclude_autographs_control"
              onChange={(checked) => updateModifier("auto", checked)}
            />
            <PricingModifierTooltip />
          </div>
        </div>
      </div>
      {modifierError ? (
        <p className="max-w-xl rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {modifierError}
        </p>
      ) : null}
    </>
  );
}

function QuickGenerateSubmitButton({
  immediatePending,
}: {
  immediatePending: boolean;
}) {
  const {pending} = useFormStatus();

  return (
    <button
      type="submit"
      disabled={immediatePending || pending}
      title="Generate AI Draft using the saved listing settings"
      className="inline-flex justify-center whitespace-nowrap rounded-full border border-stone-950 bg-stone-950 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300"
    >
      Generate AI Draft
    </button>
  );
}

export function ListingGenerateQuickAction({listing}: {listing: Listing}) {
  const {state, formAction, immediatePending, onSubmit} =
    useImmediateGenerateActionState();

  if (listing.status !== "assets_ready") {
    return null;
  }

  const browseState = getBrowsePricingUiState(listing.item_specifics);

  return (
    <form
      action={formAction}
      className="grid gap-1"
      onSubmit={onSubmit}
    >
      <input type="hidden" name="listing_id" value={listing.listing_id} />
      <input
        type="hidden"
        name="seller_hints"
        value={listing.seller_hints ?? ""}
      />
      <input
        type="hidden"
        name="auto_pricing_enabled"
        value={String(listing.auto_pricing_enabled)}
      />
      <input
        type="hidden"
        name="skip_browse"
        value={String(browseState.skipBrowse)}
      />
      <input
        type="hidden"
        name="min_price_multiplier"
        value={String(browseState.minPriceMultiplier)}
      />
      <input
        type="hidden"
        name="max_price_multiplier"
        value={
          browseState.maxPriceMultiplier === DEFAULT_BROWSE_MAX_MULTIPLIER
            ? "3.00"
            : String(browseState.maxPriceMultiplier)
        }
      />
      <QuickGenerateSubmitButton immediatePending={immediatePending} />
      <span aria-live="polite" className="sr-only">
        {state.error ?? state.info ?? state.success}
      </span>
    </form>
  );
}

export function ListingGenerateControls({listing}: {listing: Listing}) {
  const {state, formAction, immediatePending, onSubmit} =
    useImmediateGenerateActionState();

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
      <form
        action={formAction}
        className="mt-4 grid gap-4"
        onSubmit={onSubmit}
      >
        <input type="hidden" name="listing_id" value={listing.listing_id} />
        <SellerHintsField sellerHints={listing.seller_hints} />
        <PricingModifierControls
          key={getModifierStateResetKey(listing)}
          listing={listing}
          immediatePending={immediatePending}
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
