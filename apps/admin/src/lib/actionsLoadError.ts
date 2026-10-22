import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { sessionExpiredMessage } from "./sessionExpired";

export const actionsLoadError = (error: unknown) =>
  thrownRefusalMessage({
    error,
    fallback: "Failed to load actions",
    sessionExpired: sessionExpiredMessage,
  });
