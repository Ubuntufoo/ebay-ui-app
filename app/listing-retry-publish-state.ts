export interface RetryPublishListingActionState {
  error: string | null;
  success: string | null;
}

export const initialRetryPublishListingActionState: RetryPublishListingActionState = {
  error: null,
  success: null,
};