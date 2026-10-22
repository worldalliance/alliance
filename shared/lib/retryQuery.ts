import { thrownStatus } from "./hey-api";

/** The 4xx a later attempt can still satisfy: the server is telling the caller
 * to wait, not settling the question. */
const RETRYABLE_REFUSALS = new Set([408, 429]);

/** A missing status is a lost response, which asking again can fix. */
export const isRefusedStatus = (status: number | undefined): boolean =>
  status !== undefined && status < 500 && !RETRYABLE_REFUSALS.has(status);

export const isRefused = (error: unknown): boolean =>
  isRefusedStatus(thrownStatus(error));

/** React Query's `retry`, minus the refusals asking again cannot change. */
export const retryUnlessRefused =
  (retries: number) =>
  (failureCount: number, error: unknown): boolean =>
    !isRefused(error) && failureCount < retries;
