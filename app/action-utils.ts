import {SidecarApiError} from "@/lib/sidecar-api";

export function readTrimmedFormField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

type ActionErrorMessageOptions = {
  preferSidecarResponseMessage?: boolean;
};

export function getActionErrorMessage(
  error: unknown,
  fallbackMessage: string,
  options: ActionErrorMessageOptions = {},
): string {
  if (error instanceof SidecarApiError) {
    if (options.preferSidecarResponseMessage) {
      return error.response?.message ?? error.response?.error ?? error.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}
