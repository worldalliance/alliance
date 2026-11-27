import { R, type Result } from "@alliance/common/result";

/**
 * Settles a request into a Result that keeps the thrown error as it was.
 * `R.fromPromise(p)` turns hey-api's error object into an `Error` without its
 * `statusCode`, so `adminRefusalMessage(result.error, …)` could never show the
 * server's 4xx message.
 */
export const fromApi = <T>(promise: Promise<T>): Promise<Result<T, unknown>> =>
  R.fromPromise(promise, (error) => error);
