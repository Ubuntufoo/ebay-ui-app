export interface ApproveListingForExportActionState {
  error: string | null;
  success: string | null;
}

export const initialApproveListingForExportActionState: ApproveListingForExportActionState =
  {
    error: null,
    success: null,
  };
