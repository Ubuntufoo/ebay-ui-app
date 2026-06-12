export interface PricingServiceToggleActionState {
  enabled: boolean;
  error: string | null;
  success: string | null;
}

export function createPricingServiceToggleActionState(
  enabled: boolean,
): PricingServiceToggleActionState {
  return {
    enabled,
    error: null,
    success: null,
  };
}
