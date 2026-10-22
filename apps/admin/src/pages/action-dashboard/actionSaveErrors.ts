import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { sessionExpiredMessage } from "../../lib/sessionExpired";

export const imageUploadingMessage =
  "Wait for the cover image to finish uploading.";

export const actionSaveErrorMessage = (
  error: unknown,
  fallback = "Failed to save action",
): string =>
  thrownRefusalMessage({
    error,
    fallback,
    sessionExpired: sessionExpiredMessage,
  });

export const logActionError =
  (fallback?: string) =>
  (error: unknown): string => {
    console.error(error);
    return actionSaveErrorMessage(error, fallback);
  };
