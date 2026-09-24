import { thrownStatus } from "./hey-api";

/** The 4xx a later attempt can still satisfy: the server is telling the caller
 * to wait, not settling the question. */
const RETRYABLE_REFUSALS = new Set([408, 429]);

const isRefused = (error: unknown): boolean => {
  const status = thrownStatus(error);
  return (
    status !== undefined && status < 500 && !RETRYABLE_REFUSALS.has(status)
  );
};

/** React Query's `retry`, minus the refusals asking again cannot change. */
export const retryUnlessRefused =
  (retries: number) =>
  (failureCount: number, error: unknown): boolean =>
    !isRefused(error) && failureCount < retries;
