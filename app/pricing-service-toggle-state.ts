export interface PricingServiceToggleActionState {
  enabled: boolean | null;
  error: string | null;
  success: string | null;
}

export function createPricingServiceToggleActionState(
  enabled: boolean | null,
): PricingServiceToggleActionState {
  return {
    enabled,
    error: null,
    success: null,
  };
}
