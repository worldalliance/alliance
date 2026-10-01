import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { sessionExpiredMessage } from "./sessionExpired";

export const adminRefusalMessage = (error: unknown, fallback: string): string =>
  thrownRefusalMessage({
    error,
    fallback,
    sessionExpired: sessionExpiredMessage,
  });
