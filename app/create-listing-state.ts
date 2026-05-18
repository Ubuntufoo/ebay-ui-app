export interface CreateListingActionState {
  error: string | null;
  success: string | null;
}

export const initialCreateListingActionState: CreateListingActionState = {
  error: null,
  success: null,
};
