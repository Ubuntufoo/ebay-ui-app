export interface GenerateListingActionState {
  info: string | null;
  error: string | null;
  success: string | null;
}

export const initialGenerateListingActionState: GenerateListingActionState = {
  info: null,
  error: null,
  success: null,
};
