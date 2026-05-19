export interface UpdateListingStatusActionState {
  error: string | null;
  success: string | null;
}

export const initialUpdateListingStatusActionState: UpdateListingStatusActionState =
  {
    error: null,
    success: null,
  };
