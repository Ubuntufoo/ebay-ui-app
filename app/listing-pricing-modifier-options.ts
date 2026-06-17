import type {Json, Listing, PricingModifierOptions} from "@/lib/sidecar-api";

export interface ListingPricingModifierUiState {
  auto: boolean;
  graded: boolean;
  variant: boolean;
}

const defaultPricingModifierOptions: Required<PricingModifierOptions> = {
  excludeAutographs: true,
  excludeGraded: true,
  excludeVariants: false,
};

function isJsonObject(value: Json): value is Record<string, Json | undefined> {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

export function getListingPricingModifierOptions(
  itemSpecifics: Listing["item_specifics"],
): Required<PricingModifierOptions> {
  if (!isJsonObject(itemSpecifics)) {
    return defaultPricingModifierOptions;
  }

  const modifierValue = itemSpecifics["pricingModifierOptions"];

  if (modifierValue === undefined || !isJsonObject(modifierValue)) {
    return defaultPricingModifierOptions;
  }

  return {
    excludeAutographs:
      typeof modifierValue.excludeAutographs === "boolean"
        ? modifierValue.excludeAutographs
        : defaultPricingModifierOptions.excludeAutographs,
    excludeGraded:
      typeof modifierValue.excludeGraded === "boolean"
        ? modifierValue.excludeGraded
        : defaultPricingModifierOptions.excludeGraded,
    excludeVariants:
      typeof modifierValue.excludeVariants === "boolean"
        ? modifierValue.excludeVariants
        : defaultPricingModifierOptions.excludeVariants,
  };
}

export function getPricingModifierUiState(
  itemSpecifics: Listing["item_specifics"],
): ListingPricingModifierUiState {
  const options = getListingPricingModifierOptions(itemSpecifics);

  return {
    auto: options.excludeAutographs,
    graded: options.excludeGraded,
    variant: options.excludeVariants,
  };
}

export function toPricingModifierOptions(
  state: ListingPricingModifierUiState,
): PricingModifierOptions {
  return {
    excludeAutographs: state.auto,
    excludeGraded: state.graded,
    excludeVariants: state.variant,
  };
}
