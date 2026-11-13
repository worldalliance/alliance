import type { Listing } from "./spool";

const unconfirmedAfterMs = 60 * 60_000;
const keysNamed = 3;

function named(keys: string[], limit = keysNamed): string {
  const more = keys.length - limit;
  return `${keys.slice(0, limit).join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
}

export type Context = {
  /** A cause the caller's message already gives, which isn't repeated. */
  statedCause?: string;
  /** The caller's credential lookup just succeeded, so failures of an earlier
   * lookup are left out: the worker it starts retries them. */
  credentialsWork?: boolean;
  /** The caller just started a worker, which retries every failure, so each
   * reads as the last attempt's. */
  retrying?: boolean;
  /** Names every failed key, so `discard` can be given each one. */
  everyKey?: boolean;
};

/** Names transcripts whose upload failed, grouped by cause, that stayed
 * unconfirmed for an hour, or that can't be read, and a worker failure outside
 * any one upload. Names at most three keys per group, and every failed key
 * when `everyKey`. */
export function describeProblems(
  params: Context & {
    listing: Listing;
    workerError: string | undefined;
    logFile: string;
  },
): string | undefined {
  const {
    listing,
    workerError,
    logFile,
    statedCause,
    credentialsWork,
    retrying,
    everyKey,
  } = params;
  const failed = new Map<string, string>();
  const waiting = new Set<string>();
  for (const { key, error, credentialsFailed, ageMs } of listing.requests) {
    if (credentialsFailed && credentialsWork) continue;
    if (error) failed.set(key, error);
    else if (ageMs > unconfirmedAfterMs) waiting.add(key);
  }
  for (const key of failed.keys()) waiting.delete(key);
  const byCause = Map.groupBy(failed, ([, error]) => error);
  const parts = [
    ...[...byCause].map(
      ([cause, keys]) =>
        `${retrying ? "The last upload attempt failed" : "Upload failed"} for ${named(
          keys.map(([key]) => key),
          everyKey ? keys.length : keysNamed,
        )}${cause === statedCause ? " for the same reason" : `: ${cause}`}${retrying ? "; retrying now" : ""}`,
    ),
    waiting.size > 0 &&
      `Not confirmed after an hour, so check ${logFile}: ${named([...waiting])}`,
    listing.unreadable.length > 0 &&
      `Unreadable, so delete them: ${named(listing.unreadable)}`,
    workerError && `The uploader failed: ${workerError}`,
  ].filter((part) => typeof part === "string");
  return parts.length > 0 ? parts.join(". ") : undefined;
}
