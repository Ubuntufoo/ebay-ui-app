export interface SaveListingImageUrlsActionState {
  error: string | null;
  success: boolean;
}

export const initialSaveListingImageUrlsActionState: SaveListingImageUrlsActionState =
  {
    error: null,
    success: false,
  };
