/** The 4xx a later attempt can still satisfy: the server is telling the caller
 * to wait, not settling the question. */
const RETRYABLE_REFUSALS = new Set([408, 429]);

const isRefused = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if (!("statusCode" in error)) return false;
  const { statusCode } = error;
  return (
    typeof statusCode === "number" &&
    statusCode >= 400 &&
    statusCode < 500 &&
    !RETRYABLE_REFUSALS.has(statusCode)
  );
};

/** React Query's `retry`, minus the refusals asking again cannot change. The
 * client throws the response body and drops the response, so the status code
 * comes off the body, where `registerErrorStatus` leaves it. */
export const retryUnlessRefused =
  (retries: number) =>
  (failureCount: number, error: unknown): boolean =>
    !isRefused(error) && failureCount < retries;
