export interface DeleteSandboxListingActionState {
  deletedListingId: string | null;
  deletedSku: string | null;
  error: string | null;
  success: string | null;
}

export const initialDeleteSandboxListingActionState: DeleteSandboxListingActionState = {
  deletedListingId: null,
  deletedSku: null,
  error: null,
  success: null,
};
