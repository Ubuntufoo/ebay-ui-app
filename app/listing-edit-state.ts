export interface SaveListingEditsActionState {
  error: string | null;
  success: boolean;
}

export const initialSaveListingEditsActionState: SaveListingEditsActionState = {
  error: null,
  success: false,
};
