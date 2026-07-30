export interface AbandonListingActionState {
  abandonedListingId: string | null;
  error: string | null;
  success: string | null;
}

export const initialAbandonListingActionState: AbandonListingActionState = {
  abandonedListingId: null,
  error: null,
  success: null,
};
