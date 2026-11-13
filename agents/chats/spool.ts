import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";
import { R, type Result } from "../../common/src/result";

const uploadRequest = z.object({
  key: z.string(),
  file: z.string(),
  error: z.string().optional(),
  credentialsFailed: z.boolean().optional(),
});
export type UploadRequest = z.infer<typeof uploadRequest>;
/** `credentialsFailed` marks a failure of the credential lookup, which a later
 * successful lookup makes stale. */
export type UploadFailure = { error: string; credentialsFailed?: boolean };
export type Captured = UploadRequest & { path: string; ageMs: number };

export type Listing = { requests: Captured[]; unreadable: string[] };

const requestsDir = (dir: string) => path.join(dir, "requests");
const wakePath = (dir: string) => path.join(dir, "wake");

export const isMissing = (error: unknown) =>
  z.object({ code: z.literal("ENOENT") }).safeParse(error).success;

export function writeAtomically(params: {
  target: string;
  contents: string;
  times?: { atime: Date; mtime: Date };
}): void {
  const { target, contents, times } = params;
  const temp = `${target}.${randomUUID()}.tmp`;
  writeFileSync(temp, contents, { mode: 0o600 });
  if (times) utimesSync(temp, times.atime, times.mtime);
  renameSync(temp, target);
}

/** Records `upload` under a name no other request has, and sets the wakeup
 * marker so a running worker makes another pass. A failure means the request
 * wasn't recorded; `wakeError` means it was, but the marker wasn't set. */
export function publish(
  dir: string,
  upload: { key: string; file: string },
): Result<{ wakeError: Error | undefined }, Error> {
  const recorded = R.fromThrowable(() => {
    mkdirSync(requestsDir(dir), { recursive: true, mode: 0o700 });
    writeAtomically({
      target: path.join(requestsDir(dir), `${randomUUID()}.json`),
      contents: JSON.stringify(upload),
    });
  });
  if (!recorded.ok) return recorded;
  const woke = wake(dir);
  return R.success({ wakeError: woke.ok ? undefined : woke.error });
}

/** Sets the wakeup marker, so a running worker makes another pass. */
export const wake = (dir: string) =>
  R.fromThrowable(() => writeFileSync(wakePath(dir), "", { mode: 0o600 }));

function wakeMarkerOp(
  dir: string,
  op: (wake: string) => unknown,
): Result<boolean, Error> {
  const done = R.fromThrowable(() => op(wakePath(dir)));
  if (done.ok) return R.success(true);
  return isMissing(done.error) ? R.success(false) : done;
}

/** Clears the wakeup marker, returning whether it was set. */
export const takeWake = (dir: string) =>
  wakeMarkerOp(dir, (wake) => rmSync(wake));

/** Whether the wakeup marker is set; leaves it in place. */
export const wakeSet = (dir: string) =>
  wakeMarkerOp(dir, (wake) => statSync(wake));

/** Makes passes until no wakeup arrives during one, then calls `release`,
 * also when a pass throws. Returns whether the wakeup marker is set after the
 * release, which then needs a successor worker, or the failure to check it.
 * A marker it can't clear or check ends the passes: its error goes to `report`
 * after the pass and before the release, and drain returns false, since a
 * successor would meet the same marker. Run it only while holding the worker
 * lock. */
export async function drain(params: {
  dir: string;
  pass: () => Promise<void>;
  report: (error: Error) => void;
  release: () => void;
}): Promise<Result<boolean, Error>> {
  try {
    for (;;) {
      const woke = takeWake(params.dir);
      await params.pass();
      const again = woke.ok ? wakeSet(params.dir) : woke;
      if (!again.ok) {
        params.report(again.error);
        return R.success(false);
      }
      if (!again.value) break;
    }
  } finally {
    params.release();
  }
  return wakeSet(params.dir);
}

function namesEnding(dir: string, suffix: string): Result<string[], Error> {
  const names = R.fromThrowable(() => readdirSync(requestsDir(dir)));
  if (names.ok)
    return R.success(names.value.filter((name) => name.endsWith(suffix)));
  return isMissing(names.error) ? R.success([]) : names;
}

/** Leaves out a request deleted while this reads. */
export function listRequests(dir: string): Result<Listing, Error> {
  const names = namesEnding(dir, ".json");
  if (!names.ok) return names;
  const listing: Listing = { requests: [], unreadable: [] };
  const now = Date.now();
  for (const name of names.value) {
    const file = path.join(requestsDir(dir), name);
    const read = R.fromThrowable(() => ({
      text: readFileSync(file, "utf8"),
      mtimeMs: statSync(file).mtimeMs,
    }));
    if (!read.ok) {
      if (!isMissing(read.error))
        listing.unreadable.push(`${file} (${read.error.message})`);
      continue;
    }
    const json = R.fromThrowable(() => JSON.parse(read.value.text));
    if (!json.ok) {
      listing.unreadable.push(`${file} (${json.error.message})`);
      continue;
    }
    const parsed = uploadRequest.safeParse(json.value);
    if (parsed.success)
      listing.requests.push({
        ...parsed.data,
        path: file,
        ageMs: now - read.value.mtimeMs,
      });
    else {
      const issues = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      listing.unreadable.push(`${file} (${issues.join("; ")})`);
    }
  }
  return R.success(listing);
}

const staleTempMs = 60_000;

/** Deletes temp files a write killed before its rename left behind. */
function removeStaleTemps(dir: string): string[] {
  const names = namesEnding(dir, ".tmp");
  if (!names.ok) return [`${requestsDir(dir)}: ${names.error.message}`];
  const failures: string[] = [];
  for (const name of names.value) {
    const file = path.join(requestsDir(dir), name);
    const removed = R.fromThrowable(() => {
      if (Date.now() - statSync(file).mtimeMs > staleTempMs) rmSync(file);
    });
    if (!removed.ok && !isMissing(removed.error))
      failures.push(`${file}: ${removed.error.message}`);
  }
  return failures;
}

/** Uploads each key once, from requests captured before its upload starts.
 * Success deletes only those requests, so one published during the upload
 * survives; failure records the cause in the newest and deletes the rest, so a
 * key that keeps failing holds one request. Fails when the spool can't be
 * read, or with the requests it couldn't update and the stale temp files it
 * couldn't delete. A request whose transcript file is gone records `goneCause`
 * without an upload. Run it only while holding the worker lock. */
export async function runPass(params: {
  dir: string;
  goneCause: string;
  upload: (request: UploadRequest) => Promise<Result<void, UploadFailure>>;
}): Promise<Result<void, Error>> {
  const unrecorded = removeStaleTemps(params.dir);
  const listing = listRequests(params.dir);
  if (!listing.ok) return listing;
  for (const [key, captured] of Map.groupBy(
    listing.value.requests,
    (r) => r.key,
  )) {
    const [newest, ...older] = captured.toSorted((a, b) => a.ageMs - b.ageMs);
    const { file } = newest;
    const found = R.fromThrowable(() => statSync(file));
    const uploaded =
      found.ok || !isMissing(found.error)
        ? await params.upload({ key, file })
        : R.failure({ error: params.goneCause });
    const recorded = uploaded.ok
      ? R.fromThrowable(() => rmSync(newest.path, { force: true }))
      : R.fromThrowable(() => {
          // A key's requests are ordered by mtime, so the rewrite keeps it.
          writeAtomically({
            target: newest.path,
            contents: JSON.stringify({ key, file, ...uploaded.error }),
            times: statSync(newest.path),
          });
        });
    if (!recorded.ok) {
      unrecorded.push(`${newest.path}: ${recorded.error.message}`);
      continue;
    }
    for (const request of older) {
      const removed = R.fromThrowable(() =>
        rmSync(request.path, { force: true }),
      );
      if (!removed.ok)
        unrecorded.push(`${request.path}: ${removed.error.message}`);
    }
  }
  return unrecorded.length > 0
    ? R.failure(new Error(`could not update ${unrecorded.join("; ")}`))
    : R.success(undefined);
}

/** Deletes every request for `key`, returning how many there were. Run it only
 * while holding the worker lock. */
export function discard(params: {
  dir: string;
  key: string;
}): Result<number, Error> {
  const listing = listRequests(params.dir);
  if (!listing.ok) return listing;
  const matching = listing.value.requests.filter((r) => r.key === params.key);
  return R.fromThrowable(() => {
    for (const request of matching) rmSync(request.path, { force: true });
    return matching.length;
  });
}
