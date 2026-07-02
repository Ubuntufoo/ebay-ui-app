export interface ListingSubmissionActionState {
  info: string | null;
  error: string | null;
  success: string | null;
}

export type GenerateListingActionState = ListingSubmissionActionState;
export type RetryPricingActionState = ListingSubmissionActionState;

export const initialGenerateListingActionState: GenerateListingActionState = {
  info: null,
  error: null,
  success: null,
};

export const initialRetryPricingActionState: RetryPricingActionState = {
  info: null,
  error: null,
  success: null,
};
