import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { sessionExpiredMessage } from "./sessionExpired";

export const adminRefusalMessage = (error: unknown, fallback: string): string =>
  thrownRefusalMessage({
    error,
    fallback,
    sessionExpired: sessionExpiredMessage,
  });

/**
 * A failed write on one row, naming the row whatever the server says:
 * "Couldn't delete video 36." or "Couldn't delete video 36: {reason}".
 */
export const rowRefusalMessage = (error: unknown, failed: string): string => {
  const reason = adminRefusalMessage(error, "");
  return reason ? `${failed}: ${reason}` : `${failed}.`;
};
