export interface GenerateListingActionState {
  error: string | null;
  success: string | null;
}

export const initialGenerateListingActionState: GenerateListingActionState = {
  error: null,
  success: null,
};
